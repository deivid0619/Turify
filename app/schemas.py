from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from datetime import datetime
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
    
class TripType(str, Enum):
    ONE_WAY = "ONE_WAY"
    ROUND_TRIP = "ROUND_TRIP"
    
class ServiceRequestCreate(BaseModel):
    departure_time: datetime
    trip_type: TripType
    return_time: Optional[datetime] = None
    # Otros campos que necesites del formulario (ej. origen, destino)
    origin: str
    destination: str

    @model_validator(mode='after')
    def validate_dates(self) -> 'ServiceRequestCreate':
        ahora = datetime.now()
        
        # Validación 1: Fecha de salida no puede estar en el pasado
        if self.departure_time < ahora:
            raise ValueError("La fecha de salida no puede estar en el pasado.")

        # Validación 2: Lógica de Ida y Vuelta
        if self.trip_type == TripType.ROUND_TRIP:
            if not self.return_time:
                raise ValueError("El campo 'return_time' es obligatorio para viajes de ida y vuelta.")
            if self.return_time <= self.departure_time:
                raise ValueError("La fecha de regreso debe ser posterior a la de salida.")
        else:
            # Si es ONE_WAY, nos aseguramos de que sea nulo
            self.return_time = None
            
        return self
    
class ServiceRequestCreate(BaseModel):
    origin: str
    destination: str
    departure_time: datetime
    return_time: Optional[datetime] = None
    trip_type: TripType
    # Nuevos campos según tu tabla SQL
    adults_count: int 
    children_count: int = 0
    has_pets: bool = False

    @model_validator(mode='after')
    def validate_dates(self) -> 'ServiceRequestCreate':
        # ... (mantén tu lógica de validación de fechas anterior)
        
        # Validación adicional: Al menos debe viajar un adulto
        if self.adults_count <= 0:
            raise ValueError("Debe haber al menos un adulto en la solicitud.")
        return self

class ServiceRequestResponse(ServiceRequestCreate):
    request_id: int
    passenger_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
        
class DriverResponse(BaseModel):
    id: int
    full_name: str
    message: str

    class Config:
        from_attributes = True