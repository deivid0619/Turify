from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import text
from passlib.context import CryptContext # <--- Agregada
from datetime import datetime, timedelta # <--- Agregada (para el tiempo de vida del token)
from typing import Optional # <--- Agregada
from app import models, schemas
from app.database import get_db
import os
from dotenv import load_dotenv

load_dotenv()

# Variables de entorno para JWT
SECRET_KEY = os.getenv("SECRET_KEY", "una_clave_muy_secreta_para_desarrollo") 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # <--- ¿Cuánto dura la sesión? 30 minutos es un buen estándar

# Ruta que usa Swagger para probar el login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")

# Motor de encriptación de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- FUNCIONES DE CONTRASEÑAS ---

def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    """Compara la contraseña en texto plano con el hash guardado"""
    return pwd_context.verify(plain_password, hashed_password)


# --- FUNCIONES JWT ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea la 'Manilla VIP' (El Token)"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Agregamos la fecha de expiración al token
    to_encode.update({"exp": expire})
    
    # Firmamos el token con nuestra llave secreta
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """El Guardia de Seguridad: Valida el token y deja pasar al usuario"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 1. Intentamos desencriptar el token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 2. Extraemos el ID del usuario
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
    except JWTError:
        # Si el token expiró o es inválido
        raise credentials_exception
        
    # 3. Buscamos al usuario en MySQL
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    
    if user is None:
        raise credentials_exception

    # HU seguridad (OWASP A01) - le avisamos a Postgres quien es el usuario
    # actual para que las politicas RLS puedan filtrar por el. db.info queda
    # guardado en la sesion para que se reaplique solo en cada transaccion
    # nueva (ver app/database.py); ademas lo aplicamos ya mismo para la
    # transaccion en curso.
    db.info['rls_user_id'] = user.user_id
    db.info['rls_role'] = user.role
    db.execute(text("SET LOCAL app.current_user_id = :v"), {"v": str(user.user_id)})
    db.execute(text("SET LOCAL app.current_role = :v"), {"v": user.role})

    # 4. Devolvemos el usuario validado
    return user