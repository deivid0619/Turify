import os
import httpx
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app import models, schemas, security
from fastapi.security import OAuth2PasswordRequestForm
from app.security import get_current_user, get_password_hash, verify_password, create_access_token
from app.audit import registrar_log
from app.rate_limit import limiter

router = APIRouter(prefix="/users", tags=["Authentication"])

# HU seguridad (OWASP A07) - reCAPTCHA v2 en el login, solo despues de que
# una IP acumula intentos fallidos recientes (no en cada login normal).
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY")
UMBRAL_INTENTOS_CAPTCHA = 2
VENTANA_CAPTCHA_MINUTOS = 5


def _contar_fallos_recientes(db: Session, ip: str | None) -> int:
    if not ip:
        return 0
    desde = datetime.now(timezone.utc) - timedelta(minutes=VENTANA_CAPTCHA_MINUTOS)
    return db.query(models.AuditLog).filter(
        models.AuditLog.action == "LOGIN_FAILED",
        models.AuditLog.ip_address == ip,
        models.AuditLog.created_at >= desde,
    ).count()


def _verificar_captcha(token: str | None, ip: str | None) -> bool:
    if not token or not RECAPTCHA_SECRET_KEY:
        return False
    try:
        datos = {"secret": RECAPTCHA_SECRET_KEY, "response": token}
        if ip:
            datos["remoteip"] = ip
        resultado = httpx.post("https://www.google.com/recaptcha/api/siteverify", data=datos, timeout=10)
        return bool(resultado.json().get("success"))
    except Exception:
        return False

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
@limiter.limit("5/5 minutes")
def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(),
          captcha_token: str | None = Form(None), db: Session = Depends(get_db)):
    # `response` no se usa directo: slowapi lo necesita en el propio endpoint
    # (con ese nombre exacto) para poder inyectarle los headers X-RateLimit-*
    # y Retry-After cuando headers_enabled=True.
    ip = request.client.host if request.client else None

    # HU seguridad (OWASP A07) - a partir de UMBRAL_INTENTOS_CAPTCHA fallos
    # recientes de esa IP, exigimos un reCAPTCHA valido antes de siquiera
    # revisar la contraseña.
    intentos_previos = _contar_fallos_recientes(db, ip)
    if intentos_previos >= UMBRAL_INTENTOS_CAPTCHA and not _verificar_captcha(captcha_token, ip):
        raise HTTPException(
            status_code=400,
            detail="Verifica que no eres un robot para continuar.",
            headers={"X-Captcha-Required": "true"},
        )

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
        # Si este fallo hace que se cruce el umbral, avisamos desde ya para
        # que el siguiente intento muestre el captcha.
        requiere_captcha_despues = (intentos_previos + 1) >= UMBRAL_INTENTOS_CAPTCHA
        headers = {"X-Captcha-Required": "true"} if requiere_captcha_despues else {}
        raise HTTPException(status_code=400, detail="Email o contraseña incorrectos", headers=headers)

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


def _resumen_calificaciones(db: Session, user_id: int) -> dict:
    """Promedio, cantidad y últimos comentarios recibidos por un usuario.

    Sirve igual para pasajero y conductor: las calificaciones son bidireccionales,
    así que ambos reciben y a ambos les interesa ver cómo los califican.
    """
    promedio, cantidad = db.query(
        func.avg(models.Rating.score),
        func.count(models.Rating.rating_id),
    ).filter(models.Rating.rated_id == user_id).first()

    recientes = (
        db.query(models.Rating)
        .filter(models.Rating.rated_id == user_id)
        .order_by(models.Rating.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "rating_avg": round(float(promedio), 1) if promedio is not None else None,
        "rating_count": cantidad or 0,
        "rating_comentarios": [
            {
                "score": r.score,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recientes if r.comment
        ],
    }


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
                "file_url": d.file_url,
                # HU37/HU38 — solo tienen valor real en el documento RUNT
                "years_experience": d.years_experience,
                "license_categories": d.license_categories,
            }
            for d in documentos
        ]
        # HU38 — badge de conductor verificado (RUNT aprobado por el admin)
        base["conductor_verificado"] = current_user.conductor_verificado or False
        base["vehiculo"] = {
            "vehicle_id": vehiculo.vehicle_id,
            "plate": vehiculo.plate,
            "capacity": vehiculo.capacity,
            "photo_url": vehiculo.photo_url
        } if vehiculo else None
        base["empresa_afiliada"] = empresa

    # Calificaciones recibidas — mismas para los dos roles
    base.update(_resumen_calificaciones(db, current_user.user_id))

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