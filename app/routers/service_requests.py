from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, security # Tu lógica de seguridad
from ..security import get_current_user
from app.audit import registrar_log

router = APIRouter(prefix="/api/service-requests", tags=["Service Requests"])

from datetime import datetime
from fastapi import HTTPException, status, Depends
# Asegúrate de tener tus importaciones normales aquí...

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_service_request(
    request_data: schemas.ServiceRequestCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    # --- INICIO DE VALIDACIONES ---
    
    # 1. Validar que la fecha de salida no sea en el pasado
    # (Usamos .replace(tzinfo=None) por si el frontend envía fechas con zona horaria)
    if request_data.departure_time.replace(tzinfo=None) < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="La fecha y hora de salida no puede estar en el pasado."
        )

    # Convertimos el Enum a texto para las validaciones
    trip_type_str = request_data.trip_type.value if hasattr(request_data.trip_type, 'value') else request_data.trip_type

    # 2. Validaciones de Ida y Vuelta vs Solo Ida
    if trip_type_str == "ROUND_TRIP":
        if not request_data.return_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Para viajes de ida y vuelta (ROUND_TRIP), la fecha de regreso es obligatoria."
            )
        if request_data.return_time <= request_data.departure_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="La fecha de regreso debe ser posterior a la fecha de salida."
            )
    else:
        # Si es ONE_WAY, forzamos return_time a None
        request_data.return_time = None

    # --- FIN DE VALIDACIONES ---

    try:
        new_request = models.ServiceRequest(
            passenger_id=current_user.user_id,
            origin=request_data.origin,
            destination=request_data.destination,
            departure_time=request_data.departure_time,
            return_time=request_data.return_time,
            trip_type=trip_type_str,
            adults_count=request_data.adults_count,
            children_count=request_data.children_count,
            has_pets=request_data.has_pets,
            status="PENDING"
        )
        
        db.add(new_request)
        db.commit()
        db.refresh(new_request)

        # Log de creación de viaje
        registrar_log(
            db,
            action="CREATE_TRIP",
            user_id=current_user.user_id,
            entity="ServiceRequest",
            entity_id=new_request.request_id,
            detail=f"Viaje creado: {request_data.origin} → {request_data.destination}"
        )

        return new_request

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar la solicitud: {str(e)}"
        )
        
@router.get("/pending", response_model=list[schemas.ServiceRequestRead])
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Retorna la lista de viajes con estado 'PENDING' ordenados por fecha de creación.
    - Conductores: Ven todas las solicitudes pendientes.
    - Pasajeros: Ven SOLO sus propias solicitudes pendientes.
    """
    try:
        # Iniciamos la consulta base buscando los PENDING
        query = db.query(models.ServiceRequest).filter(models.ServiceRequest.status == "PENDING")
        
        # Filtro inteligente por rol: Si no es conductor, filtramos por su ID
        if current_user.role != "DRIVER": 
            query = query.filter(models.ServiceRequest.passenger_id == current_user.user_id)
            
        # Ordenamos por los más recientes y ejecutamos
        pending_requests = query.order_by(models.ServiceRequest.created_at.desc()).all()
            
        return pending_requests

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener solicitudes pendientes: {str(e)}"
        )
        
@router.post("/{request_id}/offers", status_code=status.HTTP_201_CREATED)
async def create_driver_offer(
    request_id: int,
    payload: schemas.OfferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Validar que el usuario que hace la petición sea realmente un conductor
    if current_user.role != 'DRIVER':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Solo los conductores registrados pueden enviar ofertas."
        )

    # 2. Verificar que el viaje exista y esté en estado PENDING
    service_request = db.query(models.ServiceRequest).filter(models.ServiceRequest.request_id == request_id).first()
    
    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="La solicitud de viaje no existe."
        )
        
    if service_request.status != 'PENDING':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"No se pueden hacer ofertas a viajes cerrados. Estado actual: {service_request.status}"
        )

    # 3. Obtener el vehicle_id del conductor automáticamente
    # Buscamos el primer vehículo registrado a nombre de este conductor
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.owner_id == current_user.user_id).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="No tienes un vehículo registrado para realizar esta oferta."
        )

    try:
        # 4. Crear y guardar la oferta en la base de datos
        new_offer = models.DriverOffer(
            request_id=request_id,
            driver_id=current_user.user_id, # Se extrae del token automáticamente
            vehicle_id=vehicle.vehicle_id,  # Se extrae de la consulta anterior
            offered_price=payload.offered_price, # Viene del JSON del frontend
            status='DRIVER_OFFERED'
        )

        db.add(new_offer)
        db.commit()
        db.refresh(new_offer)

        # Log de oferta enviada
        registrar_log(
            db,
            action="CREATE_OFFER",
            user_id=current_user.user_id,
            entity="DriverOffer",
            entity_id=new_offer.offer_id,
            detail=f"Oferta de ${new_offer.offered_price} para solicitud #{request_id}"
        )

        return {
            "message": "Oferta registrada exitosamente", 
            "offer_id": new_offer.offer_id,
            "offered_price": new_offer.offered_price
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error al guardar la oferta: {str(e)}"
        )