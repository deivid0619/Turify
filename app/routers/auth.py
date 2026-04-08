from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, security
from fastapi.security import OAuth2PasswordRequestForm
from app.security import get_current_user
from app.security import get_password_hash, verify_password, create_access_token

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

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
import os
from dotenv import load_dotenv

load_dotenv()

# Variables de entorno para JWT (¡Asegúrate de tenerlas en tu .env!)
SECRET_KEY = os.getenv("SECRET_KEY", "una_clave_muy_secreta_para_desarrollo") 
ALGORITHM = "HS256"

# Esto le dice a FastAPI dónde está la ruta de login para que Swagger funcione bien
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 1. Intentamos desencriptar el token con nuestra llave secreta
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 2. Extraemos el ID del usuario (guardado bajo la llave "sub")
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
    except JWTError:
        # Si el token expiró o es inventado, cae aquí
        raise credentials_exception
        
    # 3. Si el token es válido, buscamos al usuario en MySQL
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    
    if user is None:
        raise credentials_exception
        
    # 4. Devolvemos el objeto del usuario completo
    return user