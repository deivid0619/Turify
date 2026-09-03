from pydantic import BaseModel, EmailStr, Field, model_validator, field_validator
import re
from typing import Optional
from datetime import datetime
from enum import Enum

# ── Validadores reutilizables ──────────────────────────────────────────────
# Teléfono: se aceptan espacios, guiones y un prefijo internacional opcional al
# escribir, pero se guarda solo dígitos (con un posible '+' al inicio). Debe
# quedar entre 7 y 15 dígitos — nunca letras.
_RE_TELEFONO = re.compile(r'^\+?\d{7,15}$')
def _validar_telefono(v: str) -> str:
    if v is None:
        raise ValueError("El teléfono es obligatorio.")
    limpio = re.sub(r'[\s\-()]', '', str(v))
    if not _RE_TELEFONO.match(limpio):
        raise ValueError("El teléfono debe tener entre 7 y 15 dígitos y no puede contener letras.")
    return limpio

# Nombre de persona: solo letras (con tildes/ñ), espacios y algunos signos de
# nombre; mínimo 3 caracteres. Nunca dígitos.
_RE_NOMBRE = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]+$")
def _validar_nombre(v: str) -> str:
    limpio = (v or '').strip()
    if len(limpio) < 3:
        raise ValueError("El nombre debe tener al menos 3 caracteres.")
    if not _RE_NOMBRE.match(limpio):
        raise ValueError("El nombre solo puede contener letras y espacios.")
    return limpio

# Número de documento según el tipo. CC/TI: 5-10 dígitos. CE/PA: 5-15 alfanum.
def _validar_documento(numero: str, tipo: str) -> str:
    n = (numero or '').strip()
    if tipo in ('CC', 'TI'):
        if not re.match(r'^\d{5,10}$', n):
            raise ValueError("El documento (CC/TI) debe tener entre 5 y 10 dígitos.")
    else:  # CE, PA
        if not re.match(r'^[A-Za-z0-9]{5,15}$', n):
            raise ValueError("El documento (CE/PA) debe tener entre 5 y 15 caracteres alfanuméricos.")
    return n

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: str  # obligatorio

    @field_validator('full_name')
    @classmethod
    def _v_nombre(cls, v): return _validar_nombre(v)

    @field_validator('phone_number')
    @classmethod
    def _v_tel(cls, v): return _validar_telefono(v)

class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: EmailStr
    role: str
    # El telefono se declara aca a proposito: response_model descarta todo campo
    # que no este en el esquema, y el formulario de conductor lo necesita para
    # precargarse. Optional porque hay usuarios antiguos sin el dato.
    phone_number: Optional[str] = None
    profile_photo_url: Optional[str] = None

    class Config:
        from_attributes = True
        
class RoleEnum(str, Enum):
    PASSENGER = 'PASSENGER'
    DRIVER = 'DRIVER'
    ADMIN = 'ADMIN'

# Valores alineados con el enum 'doc_type' real de models.py — antes no coincidían
# (ej. aquí decía 'Licencia' pero en la BD/registro se guarda 'Licencia de Conduccion'),
# lo que rompía la validación de response_model en GET /drivers/my-documents para
# cualquier documento que no fuera exactamente 'SOAT'.
class DocumentTypeEnum(str, Enum):
    SOAT = 'SOAT'
    Licencia = 'Licencia de Conduccion'
    TarjetaOperacion = 'Tarjeta de operacion'
    Tecnomecanica = 'Tecnomecanica'
    Seguros = 'Seguros Contractual y extracontractual'
    RUNT = 'RUNT'  # HU37 — RUNT (experiencia del conductor), opcional y posterior al registro

class VerificationStatusEnum(str, Enum):
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    AI_PRE_APPROVED = 'AI_PRE_APPROVED'
    AI_PRE_REJECTED = 'AI_PRE_REJECTED'

# Esquemas de Documentos
class DocumentResponse(BaseModel):
    document_id: int
    user_id: int
    document_type: DocumentTypeEnum
    file_url: str
    verification_status: VerificationStatusEnum
    # HU37/HU38 — solo presentes en documentos tipo RUNT
    years_experience: Optional[int] = None
    license_categories: Optional[str] = None

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
    origin: str = Field(..., min_length=3, max_length=255)
    destination: str = Field(..., min_length=3, max_length=255)
    departure_time: datetime
    return_time: Optional[datetime] = None
    trip_type: TripType
    # Nuevos campos según la tabla SQL
    adults_count: int = Field(..., ge=1, le=60, description="Al menos un adulto")
    children_count: int = Field(0, ge=0, le=60)
    has_pets: bool = False
    # Épica 2 (HU25) — datos de la ruta calculados con Google Maps, para el motor de precio (Épica 12)
    origin_lat: Optional[float] = Field(None, ge=-90, le=90)
    origin_lng: Optional[float] = Field(None, ge=-180, le=180)
    destination_lat: Optional[float] = Field(None, ge=-90, le=90)
    destination_lng: Optional[float] = Field(None, ge=-180, le=180)
    distance_km: Optional[float] = Field(None, ge=0)
    tolls_count: Optional[int] = Field(None, ge=0)
    tolls_cost: Optional[float] = Field(None, ge=0)
    tipo_via: Optional[str] = None  # 'PAVIMENTADA' | 'DESTAPADA' | 'MIXTA'
    # HU55 — comodidades que el pasajero exige del vehículo (filtro de búsqueda).
    requiere_ac: Optional[bool] = False
    requiere_wifi: Optional[bool] = False
    requiere_bano: Optional[bool] = False
    requiere_musica: Optional[bool] = False
    requiere_maletero_amplio: Optional[bool] = False
    requiere_sillas_bebe: Optional[bool] = False
    requiere_acepta_mascotas: Optional[bool] = False

    @field_validator('tipo_via')
    @classmethod
    def _v_tipo_via(cls, v):
        if v is None:
            return v
        if v not in ('PAVIMENTADA', 'DESTAPADA', 'MIXTA'):
            raise ValueError("tipo_via debe ser PAVIMENTADA, DESTAPADA o MIXTA.")
        return v

    @model_validator(mode='after')
    def validate_dates(self) -> 'ServiceRequestCreate':
        # La fecha de salida no puede estar en el pasado (se compara con la misma
        # zona horaria del dato recibido para no romper por naive/aware).
        ahora = datetime.now(self.departure_time.tzinfo) if self.departure_time.tzinfo else datetime.now()
        if self.departure_time < ahora:
            raise ValueError("La fecha de salida no puede estar en el pasado.")

        if self.trip_type == TripType.ROUND_TRIP:
            if not self.return_time:
                raise ValueError("El campo 'return_time' es obligatorio para viajes de ida y vuelta.")
            if self.return_time <= self.departure_time:
                raise ValueError("La fecha de regreso debe ser posterior a la de salida.")
        else:
            self.return_time = None
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
    # HU06 — coordenadas de origen, para pintar la solicitud como pin en el mapa del conductor
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    # Coordenadas de destino — para que el conductor pueda ver la ruta trazada en su mapa
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    # HU55 — comodidades exigidas por el pasajero, visibles para el conductor en el radar
    requiere_ac: Optional[bool] = False
    requiere_wifi: Optional[bool] = False
    requiere_bano: Optional[bool] = False
    requiere_musica: Optional[bool] = False
    requiere_maletero_amplio: Optional[bool] = False
    requiere_sillas_bebe: Optional[bool] = False
    requiere_acepta_mascotas: Optional[bool] = False
    # HU55 — filtro flexible: solo presentes para el CONDUCTOR (indican cuántas de
    # las comodidades exigidas cumple su propio vehículo y cuáles le faltan)
    comodidades_exigidas: Optional[int] = None
    comodidades_cumplidas: Optional[int] = None
    comodidades_faltantes: Optional[list[str]] = None

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
# HU10 — FUEC
class TripPassengerItem(BaseModel):
    full_name: str
    document_type: str = 'CC'  # CC, TI, CE, PA
    document_number: str

    @field_validator('full_name')
    @classmethod
    def _v_nombre(cls, v): return _validar_nombre(v)

    @field_validator('document_type')
    @classmethod
    def _v_tipo(cls, v):
        if v not in ('CC', 'TI', 'CE', 'PA'):
            raise ValueError("Tipo de documento inválido (usa CC, TI, CE o PA).")
        return v

    @model_validator(mode='after')
    def _v_documento(self):
        self.document_number = _validar_documento(self.document_number, self.document_type)
        return self

class TripPassengersCreate(BaseModel):
    passengers: list[TripPassengerItem]
# HU16 — Perfil de usuario
class UpdatePhoneRequest(BaseModel):
    phone_number: str

    @field_validator('phone_number')
    @classmethod
    def _v_tel(cls, v): return _validar_telefono(v)

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

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
# HU26 — Rango geográfico de conductores
class DriverLocationUpdate(BaseModel):
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    is_online: Optional[bool] = None

# HU46 — Calificaciones bidireccionales
class RatingCreate(BaseModel):
    score: int = Field(..., ge=1, le=5, description="Calificación de 1 a 5 estrellas")
    comment: Optional[str] = None

# HU55 — Comodidades del vehículo. Las tarifas (por km, espera, día, etc.) NO las
# decide el conductor — quedaron fuera de este schema a propósito, así que PATCH
# /drivers/vehicle no puede tocarlas aunque alguien las envíe en el body.
class VehicleSettingsUpdate(BaseModel):
    capacidad_real: Optional[int] = Field(None, ge=1, le=60, description="Capacidad real de pasajeros")
    tiene_ac: Optional[bool] = None
    tiene_wifi: Optional[bool] = None
    tiene_bano: Optional[bool] = None
    tiene_musica: Optional[bool] = None
    tiene_maletero_amplio: Optional[bool] = None
    tiene_sillas_bebe: Optional[bool] = None
    acepta_mascotas: Optional[bool] = None
    cargo_mascota: Optional[float] = Field(None, ge=0)
    acepta_menores_2_anos: Optional[bool] = None

class VehicleSettingsResponse(BaseModel):
    vehicle_id: int
    plate: str
    capacity: int
    capacidad_real: Optional[int] = None
    categoria: str
    tarifa_km_base: Optional[float] = None
    tarifa_km_rango: list[float]
    tarifa_espera_hora: Optional[float] = None
    tarifa_dia: Optional[float] = None
    km_incluidos_por_dia: Optional[int] = None
    recargo_dificil_acceso: Optional[float] = None
    tiene_ac: bool
    tiene_wifi: bool
    tiene_bano: bool
    tiene_musica: bool
    tiene_maletero_amplio: bool
    tiene_sillas_bebe: bool
    acepta_mascotas: bool
    cargo_mascota: Optional[float] = None
    acepta_menores_2_anos: bool

    class Config:
        from_attributes = True
