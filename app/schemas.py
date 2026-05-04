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
        
class ServiceRequestRead(BaseModel):
    request_id: int
    passenger_id: int
    origin: str
    destination: str
    departure_time: datetime
    return_time: Optional[datetime] = None
    trip_type: str
    adults_count: int
    children_count: int
    has_pets: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True # Permite mapear desde modelos de SQLAlchemy
        
class OfferCreate(BaseModel):
    # Validamos que el precio sea mayor a 0
    offered_price: float = Field(..., gt=0, description="Precio propuesto por el conductor")
class OfferRead(BaseModel):
    offer_id: int
    request_id: int
    driver_id: int
    vehicle_id: int
    offered_price: float
    status: str
    created_at: datetime
    # Datos del conductor (se añaden manualmente en el endpoint)
    driver_name: Optional[str] = None
    driver_photo: Optional[str] = None

    class Config:
        from_attributes = True

class CounterOfferCreate(BaseModel):
    offered_price: float = Field(..., gt=0, description="Precio de contraoferta del pasajero")

class ResolveOfferCreate(BaseModel):
    action: str  # 'ACCEPT' | 'REJECT'
# --- HU16: Schemas de perfil ---

class UpdatePhoneRequest(BaseModel):
    phone_number: str

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class UpdateProfilePhotoRequest(BaseModel):
    profile_photo_url: str

class UserProfileResponse(BaseModel):
    user_id: int
    full_name: str
    email: EmailStr
    phone_number: str
    role: str
    profile_photo_url: Optional[str] = None
    age: Optional[int] = None

    class Config:
        from_attributes = True