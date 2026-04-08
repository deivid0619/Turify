from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, security

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