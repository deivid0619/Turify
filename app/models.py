from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, ForeignKey, text, DateTime, Boolean, DECIMAL, Text
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "User"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    phone_number = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('PASSENGER', 'DRIVER', 'ADMIN'), server_default="PASSENGER")
    status = Column(Enum('ACTIVE', 'INACTIVE'), server_default="ACTIVE")
    affiliated_company = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    documents = relationship("Document", back_populates="owner", cascade="all, delete")
    affiliated_company = Column(Integer, ForeignKey("AffiliatedCompany.company_id"), nullable=True)
    profile_photo_url = Column(String(255))
    age = Column(Integer)

class Document(Base):
    __tablename__ = "Document"
    document_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    document_type = Column(Enum(
        'SOAT',
        'Licencia de Conduccion',
        'Tarjeta de operacion',
        'Tecnomecanica',
        'Seguros Contractual y extracontractual'
    ), nullable=False)
    file_url = Column(String(255), nullable=False)
    verification_status = Column(Enum('PENDING', 'APPROVED', 'REJECTED'), server_default='PENDING')
    owner = relationship("User", back_populates="documents")

class ServiceRequest(Base):
    __tablename__ = "ServiceRequest"
    request_id = Column(Integer, primary_key=True, autoincrement=True)
    passenger_id = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    origin = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    trip_type = Column(Enum('ONE_WAY', 'ROUND_TRIP'), nullable=False, default='ONE_WAY')
    departure_time = Column(DateTime, nullable=False)
    return_time = Column(DateTime, nullable=True)
    adults_count = Column(Integer, nullable=False)
    children_count = Column(Integer, default=0)
    has_pets = Column(Boolean, default=False)
    status = Column(Enum('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'), default='PENDING')
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))

class Vehicle(Base):
    __tablename__ = "Vehicle"
    vehicle_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    company_id = Column(Integer, ForeignKey("AffiliatedCompany.company_id", ondelete="CASCADE"), nullable=False)
    plate = Column(String(20), unique=True, nullable=False)
    capacity = Column(Integer, nullable=False)
    photo_url = Column(String(255))

class AffiliatedCompany(Base):
    __tablename__ = "AffiliatedCompany"
    company_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    nit = Column(String(50), unique=True, nullable=False)
    logo_url = Column(String(255))

class DriverOffer(Base):
    __tablename__ = "DriverOffer"
    offer_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    driver_id = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("Vehicle.vehicle_id", ondelete="CASCADE"), nullable=False)
    offered_price = Column(DECIMAL(10,2), nullable=False)
    status = Column(Enum('DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED', 'ACCEPTED', 'REJECTED'), server_default='DRIVER_OFFERED')
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))

class AuditLog(Base):
    __tablename__ = "AuditLog"
    log_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("User.user_id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)   # LOGIN, LOGIN_FAILED, CREATE_TRIP, CREATE_OFFER, VERIFY_DOCUMENT
    entity = Column(String(50), nullable=True)    # User, ServiceRequest, DriverOffer, Document
    entity_id = Column(Integer, nullable=True)    # ID del recurso afectado
    detail = Column(Text, nullable=True)          # Info adicional (email, origen→destino, etc.)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
class Notification(Base):
    __tablename__ = "Notification"
    notification_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(Enum('NEW_OFFER', 'COUNTER_OFFER', 'TRIP_ACCEPTED', 'TRIP_REJECTED', 'TRIP_STARTED', 'TRIP_COMPLETED', 'SYSTEM'), nullable=False)
    is_read = Column(Boolean, default=False)
    related_offer_id = Column(Integer, ForeignKey("DriverOffer.offer_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))