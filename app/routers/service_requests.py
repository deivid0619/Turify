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

# SCRUM-77 — GET /api/service-requests/{request_id}/offers
# El pasajero ve todas las ofertas de su viaje con datos del conductor
@router.get("/driver/my-offers")
def get_driver_active_offers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo los conductores pueden ver sus ofertas.")

    ofertas = db.query(models.DriverOffer).filter(
        models.DriverOffer.driver_id == current_user.user_id,
        models.DriverOffer.status.in_(['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED', 'ACCEPTED'])
    ).order_by(models.DriverOffer.created_at.desc()).all()

    resultado = []
    for oferta in ofertas:
        viaje = db.query(models.ServiceRequest).filter(
            models.ServiceRequest.request_id == oferta.request_id
        ).first()
        resultado.append({
            "offer_id": oferta.offer_id,
            "request_id": oferta.request_id,
            "origin": viaje.origin if viaje else "",
            "destination": viaje.destination if viaje else "",
            "departure_time": viaje.departure_time.isoformat() if viaje and viaje.departure_time else None,
            "offered_price": float(oferta.offered_price),
            "status": oferta.status,
            "trip_status": viaje.status if viaje else "",
            "created_at": oferta.created_at.isoformat() if oferta.created_at else None
        })

    return resultado


# SCRUM-90/91 — GET /api/service-requests/notifications
# Obtener notificaciones del usuario actual

@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id
    ).order_by(models.Notification.created_at.desc()).limit(20).all()

    return [
        {
            "notification_id": n.notification_id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "related_offer_id": n.related_offer_id,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifs
    ]


# SCRUM-90/91 — PATCH /api/service-requests/notifications/{id}/read
# Marcar notificación como leída

@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    notif = db.query(models.Notification).filter(
        models.Notification.notification_id == notification_id,
        models.Notification.user_id == current_user.user_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")
    notif.is_read = True
    db.commit()
    return {"message": "Notificación marcada como leída."}


# GET /api/service-requests/assigned
# Pasajero ve sus viajes confirmados (ASSIGNED) con datos del conductor asignado

@router.get("/assigned")
def get_assigned_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viajes = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.passenger_id == current_user.user_id,
        models.ServiceRequest.status == 'ASSIGNED'
    ).order_by(models.ServiceRequest.created_at.desc()).all()

    resultado = []
    for v in viajes:
        # Buscar la oferta aceptada para obtener el conductor y precio
        oferta_aceptada = db.query(models.DriverOffer).filter(
            models.DriverOffer.request_id == v.request_id,
            models.DriverOffer.status == 'ACCEPTED'
        ).first()

        conductor_nombre = 'Conductor asignado'
        conductor_foto = None
        precio_acordado = 0

        if oferta_aceptada:
            conductor = db.query(models.User).filter(
                models.User.user_id == oferta_aceptada.driver_id
            ).first()
            if conductor:
                conductor_nombre = conductor.full_name
                conductor_foto = conductor.profile_photo_url
            precio_acordado = float(oferta_aceptada.offered_price)

        resultado.append({
            "request_id": v.request_id,
            "origin": v.origin,
            "destination": v.destination,
            "departure_time": v.departure_time.isoformat() if v.departure_time else None,
            "return_time": v.return_time.isoformat() if v.return_time else None,
            "trip_type": v.trip_type,
            "adults_count": v.adults_count,
            "children_count": v.children_count,
            "has_pets": v.has_pets,
            "status": v.status,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "conductor_nombre": conductor_nombre,
            "conductor_foto": conductor_foto,
            "precio_acordado": precio_acordado
        })

    return resultado

# HU17 — PATCH /api/service-requests/{request_id}/start
# Conductor inicia el viaje: ASSIGNED → IN_PROGRESS

@router.get("/{request_id}/offers")
def get_offers_for_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    # Verificar que el viaje exista
    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not service_request:
        raise HTTPException(status_code=404, detail="Solicitud de viaje no encontrada.")

    # Solo el pasajero dueño del viaje puede ver sus ofertas
    if service_request.passenger_id != current_user.user_id and current_user.role != 'ADMIN':
        raise HTTPException(status_code=403, detail="No tienes permiso para ver estas ofertas.")

    ofertas = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.status.in_(['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED'])
    ).all()

    resultado = []
    for oferta in ofertas:
        conductor = db.query(models.User).filter(
            models.User.user_id == oferta.driver_id
        ).first()
        resultado.append({
            "offer_id": oferta.offer_id,
            "request_id": oferta.request_id,
            "driver_id": oferta.driver_id,
            "driver_name": conductor.full_name if conductor else "Conductor",
            "driver_photo": conductor.profile_photo_url if conductor else None,
            "vehicle_id": oferta.vehicle_id,
            "offered_price": float(oferta.offered_price),
            "status": oferta.status,
            "created_at": oferta.created_at.isoformat() if oferta.created_at else None
        })

    return resultado


# SCRUM-78 — PATCH /api/offers/{offer_id}/counter-offer
# El pasajero envía una contraoferta — cambia el estado a PASSENGER_COUNTER_OFFERED
@router.patch("/offers/{offer_id}/counter-offer")
def counter_offer(
    offer_id: int,
    payload: schemas.CounterOfferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    oferta = db.query(models.DriverOffer).filter(
        models.DriverOffer.offer_id == offer_id
    ).first()

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada.")

    # Verificar que el pasajero sea el dueño del viaje
    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == oferta.request_id
    ).first()

    if not service_request or service_request.passenger_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para contraofertar en este viaje.")

    if oferta.status not in ['DRIVER_OFFERED']:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede contraofertar una oferta en estado: {oferta.status}"
        )

    oferta.offered_price = payload.offered_price
    oferta.status = 'PASSENGER_COUNTER_OFFERED'
    db.commit()
    db.refresh(oferta)

    registrar_log(
        db,
        action="COUNTER_OFFER",
        user_id=current_user.user_id,
        entity="DriverOffer",
        entity_id=oferta.offer_id,
        detail=f"Contraoferta de ${payload.offered_price} para oferta #{offer_id}"
    )

    # Notificar al conductor que recibió una contraoferta
    pasajero = db.query(models.User).filter(
        models.User.user_id == current_user.user_id
    ).first()
    nombre_pasajero = pasajero.full_name if pasajero else "El pasajero"

    crear_notificacion(
        db,
        user_id=oferta.driver_id,
        title="Nueva contraoferta recibida",
        message=f"{nombre_pasajero} propuso ${payload.offered_price:,.0f} para el viaje de {service_request.origin} → {service_request.destination}.",
        tipo="COUNTER_OFFER",
        offer_id=oferta.offer_id
    )

    return {
        "message": "Contraoferta enviada al conductor.",
        "offer_id": oferta.offer_id,
        "nuevo_precio": float(oferta.offered_price),
        "nuevo_estado": oferta.status
    }


# SCRUM-81 — PATCH /api/offers/{offer_id}/accept
# El pasajero acepta una oferta — pasa a ACCEPTED y el viaje a ASSIGNED
@router.patch("/offers/{offer_id}/accept")
def accept_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    oferta = db.query(models.DriverOffer).filter(
        models.DriverOffer.offer_id == offer_id
    ).first()

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada.")

    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == oferta.request_id
    ).first()

    if not service_request or service_request.passenger_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para aceptar esta oferta.")

    if oferta.status not in ['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED']:
        raise HTTPException(status_code=400, detail=f"No se puede aceptar una oferta en estado: {oferta.status}")

    # Aceptar esta oferta
    oferta.status = 'ACCEPTED'

    # Rechazar todas las demás ofertas del mismo viaje
    otras_ofertas = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == oferta.request_id,
        models.DriverOffer.offer_id != offer_id
    ).all()
    for otra in otras_ofertas:
        otra.status = 'REJECTED'

    # Marcar el viaje como ASSIGNED
    service_request.status = 'ASSIGNED'

    db.commit()

    registrar_log(
        db,
        action="ACCEPT_OFFER",
        user_id=current_user.user_id,
        entity="DriverOffer",
        entity_id=oferta.offer_id,
        detail=f"Oferta #{offer_id} aceptada. Viaje #{oferta.request_id} asignado al conductor #{oferta.driver_id}"
    )

    # Notificar al conductor que su oferta fue aceptada
    pasajero = db.query(models.User).filter(
        models.User.user_id == current_user.user_id
    ).first()
    nombre_pasajero = pasajero.full_name if pasajero else "El pasajero"

    crear_notificacion(
        db,
        user_id=oferta.driver_id,
        title="¡Tu oferta fue aceptada!",
        message=f"{nombre_pasajero} aceptó tu oferta de ${float(oferta.offered_price):,.0f}. Viaje de {service_request.origin} → {service_request.destination}.",
        tipo="TRIP_ACCEPTED",
        offer_id=oferta.offer_id
    )

    # Notificar a los conductores cuyas ofertas fueron rechazadas
    for otra in otras_ofertas:
        crear_notificacion(
            db,
            user_id=otra.driver_id,
            title="Oferta no seleccionada",
            message=f"El pasajero eligió otra oferta para el viaje de {service_request.origin} → {service_request.destination}.",
            tipo="TRIP_REJECTED",
            offer_id=otra.offer_id
        )

    return {
        "message": "¡Oferta aceptada! El viaje ha sido asignado al conductor.",
        "offer_id": oferta.offer_id,
        "request_id": oferta.request_id,
        "estado_oferta": "ACCEPTED",
        "estado_viaje": "ASSIGNED"
    }

# --- Función auxiliar para crear notificaciones ---
def crear_notificacion(db, user_id: int, title: str, message: str, tipo: str, offer_id: int = None):
    try:
        notif = models.Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=tipo,
            related_offer_id=offer_id
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Notificación] Error: {e}")


# SCRUM-82 — PATCH /api/service-requests/offers/{offer_id}/resolve
# El conductor responde a una contraoferta: acepta o rechaza
@router.patch("/offers/{offer_id}/resolve")
def resolve_counter_offer(
    offer_id: int,
    payload: schemas.ResolveOfferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo los conductores pueden responder contraoferta.")

    oferta = db.query(models.DriverOffer).filter(
        models.DriverOffer.offer_id == offer_id,
        models.DriverOffer.driver_id == current_user.user_id
    ).first()

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada o no te pertenece.")

    if oferta.status != 'PASSENGER_COUNTER_OFFERED':
        raise HTTPException(
            status_code=400,
            detail=f"Solo puedes resolver ofertas en estado PASSENGER_COUNTER_OFFERED. Estado actual: {oferta.status}"
        )

    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == oferta.request_id
    ).first()

    if payload.action == 'ACCEPT':
        # Aceptar la contraoferta — el viaje queda asignado
        oferta.status = 'ACCEPTED'
        service_request.status = 'ASSIGNED'

        # Rechazar las demás ofertas del mismo viaje
        otras = db.query(models.DriverOffer).filter(
            models.DriverOffer.request_id == oferta.request_id,
            models.DriverOffer.offer_id != offer_id
        ).all()
        for otra in otras:
            otra.status = 'REJECTED'

        db.commit()

        # Notificar al pasajero que el conductor aceptó
        crear_notificacion(
            db,
            user_id=service_request.passenger_id,
            title="¡Viaje confirmado!",
            message=f"El conductor aceptó tu contraoferta de ${oferta.offered_price}. Tu viaje está confirmado.",
            tipo="TRIP_ACCEPTED",
            offer_id=oferta.offer_id
        )

        registrar_log(db, action="ACCEPT_COUNTER_OFFER", user_id=current_user.user_id,
            entity="DriverOffer", entity_id=oferta.offer_id,
            detail=f"Conductor #{current_user.user_id} aceptó contraoferta de ${oferta.offered_price}")

        return {
            "message": "Contraoferta aceptada. El viaje ha sido confirmado.",
            "offer_id": oferta.offer_id,
            "estado_oferta": "ACCEPTED",
            "estado_viaje": "ASSIGNED"
        }

    elif payload.action == 'REJECT':
        # Rechazar la contraoferta — su oferta se cancela
        oferta.status = 'REJECTED'
        db.commit()

        # Notificar al pasajero que el conductor rechazó
        crear_notificacion(
            db,
            user_id=service_request.passenger_id,
            title="Conductor rechazó la contraoferta",
            message="Un conductor rechazó tu contraoferta. Puedes aceptar otra oferta disponible.",
            tipo="TRIP_REJECTED",
            offer_id=oferta.offer_id
        )

        registrar_log(db, action="REJECT_COUNTER_OFFER", user_id=current_user.user_id,
            entity="DriverOffer", entity_id=oferta.offer_id,
            detail=f"Conductor #{current_user.user_id} rechazó contraoferta")

        return {
            "message": "Has rechazado la contraoferta. Tu oferta fue cancelada.",
            "offer_id": oferta.offer_id,
            "estado_oferta": "REJECTED"
        }

    else:
        raise HTTPException(status_code=400, detail="Acción inválida. Use 'ACCEPT' o 'REJECT'.")


# SCRUM-83 — GET /api/service-requests/driver/my-offers
# El conductor ve sus negociaciones activas (SCRUM-83)




@router.patch("/{request_id}/start")
def start_trip(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo el conductor puede iniciar el viaje.")

    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.status != 'ASSIGNED':
        raise HTTPException(status_code=400, detail=f"El viaje debe estar en estado ASSIGNED para iniciarlo. Estado actual: {viaje.status}")

    # Verificar que el conductor sea el asignado
    oferta_aceptada = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.driver_id == current_user.user_id,
        models.DriverOffer.status == 'ACCEPTED'
    ).first()

    if not oferta_aceptada:
        raise HTTPException(status_code=403, detail="No eres el conductor asignado a este viaje.")

    viaje.status = 'IN_PROGRESS'
    db.commit()

    # Notificar al pasajero
    crear_notificacion(
        db,
        user_id=viaje.passenger_id,
        title="¡Tu viaje ha comenzado!",
        message=f"El conductor está en camino. Viaje de {viaje.origin} a {viaje.destination}.",
        tipo="TRIP_STARTED",
        offer_id=oferta_aceptada.offer_id
    )

    registrar_log(db, action="TRIP_STARTED", user_id=current_user.user_id,
        entity="ServiceRequest", entity_id=viaje.request_id,
        detail=f"Viaje #{request_id} iniciado por conductor #{current_user.user_id}")

    return {
        "message": "¡Viaje iniciado! El pasajero ha sido notificado.",
        "request_id": viaje.request_id,
        "status": "IN_PROGRESS"
    }


# HU17 — PATCH /api/service-requests/{request_id}/complete
# Conductor finaliza el viaje: IN_PROGRESS → COMPLETED
@router.patch("/{request_id}/complete")
def complete_trip(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo el conductor puede finalizar el viaje.")

    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.status != 'IN_PROGRESS':
        raise HTTPException(status_code=400, detail=f"El viaje debe estar EN CURSO para finalizarlo. Estado actual: {viaje.status}")

    # Verificar que el conductor sea el asignado
    oferta_aceptada = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.driver_id == current_user.user_id,
        models.DriverOffer.status == 'ACCEPTED'
    ).first()

    if not oferta_aceptada:
        raise HTTPException(status_code=403, detail="No eres el conductor asignado a este viaje.")

    viaje.status = 'COMPLETED'
    db.commit()

    # Notificar al pasajero
    crear_notificacion(
        db,
        user_id=viaje.passenger_id,
        title="¡Viaje completado!",
        message=f"Tu viaje de {viaje.origin} a {viaje.destination} ha finalizado. ¡Gracias por usar Turify!",
        tipo="TRIP_COMPLETED",
        offer_id=oferta_aceptada.offer_id
    )

    registrar_log(db, action="TRIP_COMPLETED", user_id=current_user.user_id,
        entity="ServiceRequest", entity_id=viaje.request_id,
        detail=f"Viaje #{request_id} completado por conductor #{current_user.user_id}")

    return {
        "message": "¡Viaje completado! Gracias por usar Turify.",
        "request_id": viaje.request_id,
        "status": "COMPLETED"
    }


# HU17 — GET /api/service-requests/{request_id}/status
# Pasajero consulta el estado actual de su viaje
@router.get("/{request_id}/status")
def get_trip_status(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.passenger_id != current_user.user_id and current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este viaje.")

    return {
        "request_id": viaje.request_id,
        "status": viaje.status,
        "origin": viaje.origin,
        "destination": viaje.destination,
        "departure_time": viaje.departure_time.isoformat() if viaje.departure_time else None
    }