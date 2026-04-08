from pydantic import BaseModel, EmailStr, Field
from typing import Optional

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