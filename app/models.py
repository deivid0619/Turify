from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, func
from app.database import Base
import enum

class UserRole(str, enum.Enum):
    PASSENGER = "PASSENGER"
    DRIVER = "DRIVER"
    ADMIN = "ADMIN"

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PENDING = "PENDING"
    INACTIVE = "INACTIVE"

class User(Base):
    # 1. El nombre exacto de la tabla en tu MySQL Workbench
    __tablename__ = "User" 

    # 2. Los campos exactos de tu script SQL
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone_number = Column(String(20), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.PASSENGER)
    affiliated_company = Column(String(100), nullable=True)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE)
    created_at = Column(TIMESTAMP, server_default=func.now())