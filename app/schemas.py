from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from enum import Enum

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: str # Ahora es obligatorio según tu SQL

class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True
        
class RoleEnum(str, Enum):
    PASSENGER = 'PASSENGER'
    DRIVER = 'DRIVER'
    ADMIN = 'ADMIN'

class DocumentTypeEnum(str, Enum):
    SOAT = 'SOAT'
    Licencia = 'Licencia'
    Seguros = 'Seguros'
    Certificado = 'Certificado Afiliación'
    Antecedentes = 'Antecedentes'

class VerificationStatusEnum(str, Enum):
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'

# Esquemas de Documentos
class DocumentResponse(BaseModel):
    document_id: int
    user_id: int
    document_type: DocumentTypeEnum
    file_url: str
    verification_status: VerificationStatusEnum

    class Config:
        from_attributes = True

# Esquemas de Tokens y Login
class TokenResponse(BaseModel):
    access_token: str
    token_type: str