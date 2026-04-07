from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(..., max_length=72)
    # Hacemos el teléfono opcional para el registro inicial
    phone_number: Optional[str] = None