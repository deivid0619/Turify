from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, ForeignKey, text
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "User"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    phone_number = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Reflejamos los ENUM de tu SQL
    role = Column(Enum('PASSENGER', 'DRIVER', 'ADMIN'), server_default="PASSENGER")
    status = Column(Enum('ACTIVE', 'INACTIVE'), server_default="ACTIVE")
    
    affiliated_company = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))

    # Relación con documentos
    documents = relationship("Document", back_populates="owner", cascade="all, delete")

class Document(Base):
    __tablename__ = "Document"

    document_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("User.user_id", on_delete="CASCADE"), nullable=False)
    document_type = Column(Enum('SOAT', 'Licencia', 'Seguros', 'Certificado Afiliación', 'Antecedentes'), nullable=False)
    file_url = Column(String(255), nullable=False)
    verification_status = Column(Enum('PENDING', 'APPROVED', 'REJECTED'), server_default="PENDING")
    uploaded_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))

    owner = relationship("User", back_populates="documents")