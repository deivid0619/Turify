from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, security
from fastapi.security import OAuth2PasswordRequestForm
from app.security import get_current_user, get_password_hash, verify_password, create_access_token
from app.audit import registrar_log

router = APIRouter(prefix="/users", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_passenger(user: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered in Turify")

    hashed_password = security.get_password_hash(user.password)
    new_user = models.User(
        full_name=user.full_name,
        email=user.email,
        phone_number=user.phone_number,
        password_hash=hashed_password,
        role="PASSENGER"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    registrar_log(
        db,
        action="REGISTER",
        user_id=new_user.user_id,
        entity="User",
        entity_id=new_user.user_id,
        detail=f"Nuevo pasajero registrado: {new_user.email}",
        ip_address=request.client.host if request.client else None
    )
    return new_user

@router.post("/login", response_model=schemas.TokenResponse)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    if not user or not security.verify_password(form_data.password, user.password_hash):
        registrar_log(
            db,
            action="LOGIN_FAILED",
            user_id=user.user_id if user else None,
            entity="User",
            detail=f"Login fallido para: {form_data.username}",
            ip_address=ip
        )
        raise HTTPException(status_code=400, detail="Email o contraseña incorrectos")

    access_token = security.create_access_token(data={"sub": str(user.user_id)})

    registrar_log(
        db,
        action="LOGIN",
        user_id=user.user_id,
        entity="User",
        entity_id=user.user_id,
        detail=f"Login exitoso: {user.email} (rol: {user.role})",
        ip_address=ip
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserResponse)
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

# SCRUM-113 — GET /users/me (enriquecido con datos completos según rol)
@router.get("/me/profile")
def get_full_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna perfil completo según el rol del usuario."""
    base = {
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone_number": current_user.phone_number,
        "role": current_user.role,
        "profile_photo_url": current_user.profile_photo_url,
        "age": current_user.age,
    }

    if current_user.role == 'PASSENGER':
        # SCRUM-116: Historial de viajes del pasajero
        viajes = db.query(models.ServiceRequest).filter(
            models.ServiceRequest.passenger_id == current_user.user_id
        ).order_by(models.ServiceRequest.created_at.desc()).limit(20).all()

        ofertas_activas = db.query(models.DriverOffer).join(
            models.ServiceRequest,
            models.DriverOffer.request_id == models.ServiceRequest.request_id
        ).filter(
            models.ServiceRequest.passenger_id == current_user.user_id,
            models.DriverOffer.status.in_(['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED'])
        ).count()

        base["historial_viajes"] = [
            {
                "request_id": v.request_id,
                "origin": v.origin,
                "destination": v.destination,
                "departure_time": v.departure_time.isoformat() if v.departure_time else None,
                "status": v.status,
                "created_at": v.created_at.isoformat() if v.created_at else None
            }
            for v in viajes
        ]
        base["ofertas_activas"] = ofertas_activas

    elif current_user.role == 'DRIVER':
        # Documentos del conductor
        documentos = db.query(models.Document).filter(
            models.Document.user_id == current_user.user_id
        ).all()

        # Vehículo
        vehiculo = db.query(models.Vehicle).filter(
            models.Vehicle.owner_id == current_user.user_id
        ).first()

        # Empresa afiliada
        empresa = None
        if current_user.affiliated_company:
            emp = db.query(models.AffiliatedCompany).filter(
                models.AffiliatedCompany.company_id == current_user.affiliated_company
            ).first()
            if emp:
                empresa = {"company_id": emp.company_id, "name": emp.name}

        base["documentos"] = [
            {
                "document_id": d.document_id,
                "document_type": d.document_type,
                "verification_status": d.verification_status,
                "file_url": d.file_url
            }
            for d in documentos
        ]
        base["vehiculo"] = {
            "vehicle_id": vehiculo.vehicle_id,
            "plate": vehiculo.plate,
            "capacity": vehiculo.capacity,
            "photo_url": vehiculo.photo_url
        } if vehiculo else None
        base["empresa_afiliada"] = empresa
        base["rating_avg"] = 5.0  # Por ahora fijo — se implementará con calificaciones reales

    return base


# SCRUM-114 — PATCH /users/me — actualizar teléfono
@router.patch("/me/phone")
def update_phone(
    payload: schemas.UpdatePhoneRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.phone_number = payload.phone_number
    db.commit()
    registrar_log(db, action="UPDATE_PROFILE", user_id=current_user.user_id,
        entity="User", entity_id=current_user.user_id, detail="Teléfono actualizado")
    return {"message": "Teléfono actualizado correctamente.", "phone_number": current_user.phone_number}


# SCRUM-115 — PATCH /users/me/password — cambiar contraseña
@router.patch("/me/password")
def update_password(
    payload: schemas.UpdatePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not security.verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")

    current_user.password_hash = security.get_password_hash(payload.new_password)
    db.commit()
    registrar_log(db, action="UPDATE_PASSWORD", user_id=current_user.user_id,
        entity="User", entity_id=current_user.user_id, detail="Contraseña cambiada")
    return {"message": "Contraseña actualizada correctamente."}