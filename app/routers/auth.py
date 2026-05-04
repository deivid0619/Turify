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