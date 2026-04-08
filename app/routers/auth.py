from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, security
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/users", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_passenger(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Check if the email is already registered
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered in Turify")

    # 2. Hash the password
    hashed_password = security.get_password_hash(user.password)
    

    # 3. Create the user object (Default role for HU01: PASSENGER)
    new_user = models.User(
        full_name=user.full_name,
        email=user.email,
        phone_number=user.phone_number,
        password_hash=hashed_password,
        role="PASSENGER" # Valor por defecto
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

    return {"message": "Passenger registered successfully", "user_id": new_user.id}

@router.post("/login", response_model=schemas.TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Email o contraseña incorrectos")
    
    # Generar el Token
    access_token = security.create_access_token(data={"sub": str(user.user_id)})
    return {"access_token": access_token, "token_type": "bearer"}