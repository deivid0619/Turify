from sqlalchemy import (
    Column, Integer, String, Enum, ForeignKey, DateTime,
    Boolean, Numeric, Text, Index, JSON
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AffiliatedCompany(Base):
    __tablename__ = "AffiliatedCompany"

    company_id  = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name        = Column(String(100), nullable=False)
    nit         = Column(String(50), unique=True, nullable=False)
    logo_url    = Column(Text)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    users    = relationship("User", back_populates="company")
    vehicles = relationship("Vehicle", back_populates="company")


class User(Base):
    __tablename__ = "User"

    user_id             = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name           = Column(String(100), nullable=False)
    email               = Column(String(100), unique=True, nullable=False)
    phone_number        = Column(String(20), nullable=False)
    password_hash       = Column(String(255), nullable=False)
    role                = Column(Enum('PASSENGER', 'DRIVER', 'ADMIN', name='user_role'), default='PASSENGER')
    status              = Column(Enum('ACTIVE', 'INACTIVE', name='user_status'), default='ACTIVE')
    affiliated_company  = Column(Integer, ForeignKey("AffiliatedCompany.company_id", ondelete="SET NULL"), nullable=True)
    profile_photo_url   = Column(Text)
    age                 = Column(Integer)
    # Campos nuevos — rango geográfico de conductores (Épica 3)
    current_lat         = Column(Numeric(10, 8))
    current_lng         = Column(Numeric(11, 8))
    is_online           = Column(Boolean, default=False)
    # Campos nuevos — calificaciones (Épica 7)
    rating_avg          = Column(Numeric(3, 2), default=0.00)
    total_ratings       = Column(Integer, default=0)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())

    company     = relationship("AffiliatedCompany", back_populates="users")
    documents   = relationship("Document", back_populates="owner", cascade="all, delete")
    vehicles    = relationship("Vehicle", back_populates="owner", cascade="all, delete")


class Document(Base):
    __tablename__ = "Document"

    document_id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id             = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    document_type       = Column(Enum(
        'SOAT', 'Licencia de Conduccion', 'Tarjeta de operacion',
        'Tecnomecanica', 'Seguros Contractual y extracontractual', 'RUNT',
        name='doc_type'
    ), nullable=False)
    file_url            = Column(Text, nullable=False)
    verification_status = Column(Enum(
        'PENDING', 'APPROVED', 'REJECTED', 'AI_PRE_APPROVED', 'AI_PRE_REJECTED',
        name='verification_status'
    ), default='PENDING')
    # Campos nuevos — Agente IA verificación (Épica 4 HU44)
    ai_extracted_data   = Column(JSONB)
    ai_expiry_date      = Column(DateTime)
    ai_holder_name      = Column(String(100))
    ai_confidence       = Column(Numeric(5, 2))
    ai_observations     = Column(Text)
    # Para RUNT
    years_experience    = Column(Integer)
    license_categories  = Column(String(50))
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="documents")


class Vehicle(Base):
    __tablename__ = "Vehicle"

    vehicle_id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id                = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    company_id              = Column(Integer, ForeignKey("AffiliatedCompany.company_id", ondelete="SET NULL"), nullable=True)
    plate                   = Column(String(20), unique=True, nullable=False)
    capacity                = Column(Integer, nullable=False)
    capacidad_real          = Column(Integer)
    vehicle_year            = Column(Integer)
    photo_url               = Column(Text)
    # Tarifas personalizadas (Épica 4)
    tarifa_km_base          = Column(Numeric(10, 2))
    tarifa_espera_hora      = Column(Numeric(10, 2))
    tarifa_dia              = Column(Numeric(10, 2))
    km_incluidos_por_dia    = Column(Integer, default=200)
    recargo_dificil_acceso  = Column(Numeric(5, 2), default=15.00)
    # Comodidades (Épica 4 HU38)
    tiene_ac                = Column(Boolean, default=False)
    tiene_wifi              = Column(Boolean, default=False)
    tiene_bano              = Column(Boolean, default=False)
    tiene_musica            = Column(Boolean, default=False)
    tiene_maletero_amplio   = Column(Boolean, default=False)
    tiene_sillas_bebe       = Column(Boolean, default=False)
    acepta_mascotas         = Column(Boolean, default=False)
    cargo_mascota           = Column(Numeric(10, 2), default=0)
    acepta_menores_2_anos   = Column(Boolean, default=True)
    created_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())

    owner   = relationship("User", back_populates="vehicles")
    company = relationship("AffiliatedCompany", back_populates="vehicles")


class ServiceRequest(Base):
    __tablename__ = "ServiceRequest"

    request_id          = Column(Integer, primary_key=True, autoincrement=True)
    passenger_id        = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    origin              = Column(String(255), nullable=False)
    destination         = Column(String(255), nullable=False)
    origin_lat          = Column(Numeric(10, 8))
    origin_lng          = Column(Numeric(11, 8))
    destination_lat     = Column(Numeric(10, 8))
    destination_lng     = Column(Numeric(11, 8))
    trip_type           = Column(Enum('ONE_WAY', 'ROUND_TRIP', name='trip_type'), nullable=False, default='ONE_WAY')
    departure_time      = Column(TIMESTAMP(timezone=True), nullable=False)
    return_time         = Column(TIMESTAMP(timezone=True))
    adults_count        = Column(Integer, nullable=False)
    children_count      = Column(Integer, default=0)
    infants_count       = Column(Integer, default=0)
    has_pets            = Column(Boolean, default=False)
    num_pets            = Column(Integer, default=0)
    status              = Column(Enum(
        'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SCHEDULED',
        name='request_status'
    ), default='PENDING')
    # Campos nuevos — Agente IA precio (Épica 4)
    distance_km         = Column(Numeric(10, 2))
    tolls_count         = Column(Integer, default=0)
    tolls_cost          = Column(Numeric(10, 2), default=0)
    wait_time_hours     = Column(Numeric(5, 2), default=0)
    num_days            = Column(Integer, default=1)
    tipo_via            = Column(Enum('PAVIMENTADA', 'DESTAPADA', 'MIXTA', name='via_type'), default='PAVIMENTADA')
    is_peak_hour        = Column(Boolean, default=False)
    is_high_season      = Column(Boolean, default=False)
    suggested_price     = Column(Numeric(10, 2))
    suggested_price_min = Column(Numeric(10, 2))
    suggested_price_max = Column(Numeric(10, 2))
    price_explanation   = Column(Text)
    intermediate_stops  = Column(JSONB)
    # HU09 — Punto y radio de búsqueda de conductores (definido por el pasajero;
    # por defecto es el origen del viaje, pero puede moverse, ej. buscar conductores
    # cerca de la cabecera municipal en vez de una finca alejada)
    search_lat           = Column(Numeric(10, 8))
    search_lng           = Column(Numeric(11, 8))
    search_radius_km     = Column(Numeric(5, 2), default=15)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class DriverOffer(Base):
    __tablename__ = "DriverOffer"

    offer_id        = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id      = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    driver_id       = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    vehicle_id      = Column(Integer, ForeignKey("Vehicle.vehicle_id", ondelete="CASCADE"), nullable=False)
    offered_price   = Column(Numeric(10, 2), nullable=False)
    status          = Column(Enum(
        'DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED', 'ACCEPTED', 'REJECTED',
        name='offer_status'
    ), default='DRIVER_OFFERED')
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TripPassenger(Base):
    __tablename__ = "TripPassenger"

    passenger_entry_id  = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id          = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    full_name           = Column(String(100), nullable=False)
    document_type       = Column(Enum('CC', 'TI', 'CE', 'PA', name='doc_id_type'), default='CC')
    document_number     = Column(String(20), nullable=False)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "AuditLog"

    log_id      = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("User.user_id", ondelete="SET NULL"), nullable=True)
    action      = Column(String(50), nullable=False)
    entity      = Column(String(50))
    entity_id   = Column(Integer)
    detail      = Column(Text)
    ip_address  = Column(String(45))
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "Notification"

    notification_id     = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id             = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    title               = Column(String(100), nullable=False)
    message             = Column(Text, nullable=False)
    type                = Column(Enum(
        'NEW_OFFER', 'COUNTER_OFFER', 'TRIP_ACCEPTED', 'TRIP_REJECTED',
        'TRIP_STARTED', 'TRIP_COMPLETED', 'SYSTEM',
        name='notification_type'
    ), nullable=False)
    is_read             = Column(Boolean, default=False)
    related_offer_id    = Column(Integer, ForeignKey("DriverOffer.offer_id", ondelete="SET NULL"), nullable=True)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class PriceHistory(Base):
    """Historial de precios para alimentar el agente IA (Épica 4)"""
    __tablename__ = "PriceHistory"

    history_id          = Column(Integer, primary_key=True, autoincrement=True)
    request_id          = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="SET NULL"), nullable=True)
    vehicle_category    = Column(Enum('SEDAN', 'VAN', 'MICROBUS', 'BUS', 'BUS_GRANDE', name='vehicle_category'), nullable=False)
    distance_km         = Column(Numeric(10, 2), nullable=False)
    suggested_price     = Column(Numeric(10, 2), nullable=False)
    final_price         = Column(Numeric(10, 2))
    tolls_cost          = Column(Numeric(10, 2), default=0)
    wait_time_hours     = Column(Numeric(5, 2), default=0)
    num_days            = Column(Integer, default=1)
    is_peak_hour        = Column(Boolean, default=False)
    is_high_season      = Column(Boolean, default=False)
    tipo_via            = Column(Enum('PAVIMENTADA', 'DESTAPADA', 'MIXTA', name='via_type'))
    has_ac              = Column(Boolean, default=False)
    has_wifi            = Column(Boolean, default=False)
    num_passengers      = Column(Integer, nullable=False)
    origin_city         = Column(String(100))
    destination_city    = Column(String(100))
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TripStop(Base):
    """Paradas intermedias en un viaje"""
    __tablename__ = "TripStop"

    stop_id     = Column(Integer, primary_key=True, autoincrement=True)
    request_id  = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    stop_order  = Column(Integer, nullable=False)
    address     = Column(String(255), nullable=False)
    lat         = Column(Numeric(10, 8))
    lng         = Column(Numeric(11, 8))
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Rating(Base):
    """Calificaciones bidireccionales pasajero ↔ conductor (Épica 7)"""
    __tablename__ = "Rating"

    rating_id   = Column(Integer, primary_key=True, autoincrement=True)
    request_id  = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    rater_id    = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    rated_id    = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    score       = Column(Integer, nullable=False)
    comment     = Column(Text)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())