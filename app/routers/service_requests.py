from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, security # Tu lógica de seguridad

router = APIRouter(prefix="/api/service-requests", tags=["Service Requests"])

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_service_request(
    request_data: schemas.ServiceRequestCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    try:
        new_request = models.ServiceRequest(
            passenger_id=current_user.user_id,
            origin=request_data.origin,
            destination=request_data.destination,
            departure_time=request_data.departure_time,
            return_time=request_data.return_time,
            trip_type=request_data.trip_type.value,
            # Mapeo de los nuevos campos de pasajeros
            adults_count=request_data.adults_count,
            children_count=request_data.children_count,
            has_pets=request_data.has_pets,
            status="PENDING"
        )
        
        db.add(new_request)
        db.commit()
        db.refresh(new_request)
        return new_request

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar la solicitud: {str(e)}"
        )