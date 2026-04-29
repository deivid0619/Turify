from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.database import get_db
from app.security import get_current_user
from app import models

router = APIRouter(prefix="/admin", tags=["Admin"])

# --- Schemas locales ---
class DocumentVerifyRequest(BaseModel):
    verification_status: str  # 'APPROVED' | 'REJECTED'

class DocumentOut(BaseModel):
    document_id: int
    document_type: str
    file_url: str
    verification_status: str

    class Config:
        from_attributes = True

class DriverPendingOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    phone_number: str
    profile_photo_url: str | None
    role: str
    documents: List[DocumentOut]

    class Config:
        from_attributes = True

# --- Dependencia: solo ADMIN puede acceder ---
def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requiere rol ADMIN."
        )
    return current_user

# --- GET /admin/drivers/pending ---
# Retorna todos los usuarios con documentos en estado PENDING
@router.get("/drivers/pending", response_model=List[DriverPendingOut])
def get_pending_drivers(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    # Buscamos usuarios que tengan al menos un documento PENDING
    usuarios_con_docs_pendientes = (
        db.query(models.User)
        .join(models.Document, models.Document.user_id == models.User.user_id)
        .filter(models.Document.verification_status == 'PENDING')
        .distinct()
        .all()
    )
    return usuarios_con_docs_pendientes

# --- PATCH /admin/documents/{document_id}/verify ---
# Aprueba o rechaza un documento específico
@router.patch("/documents/{document_id}/verify")
def verify_document(
    document_id: int,
    payload: DocumentVerifyRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    # Validar el valor del status
    if payload.verification_status not in ['APPROVED', 'REJECTED']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado inválido. Use 'APPROVED' o 'REJECTED'."
        )

    # Buscar el documento
    documento = db.query(models.Document).filter(
        models.Document.document_id == document_id
    ).first()

    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    # Actualizar estado
    documento.verification_status = payload.verification_status
    db.commit()
    db.refresh(documento)

    # Si se aprobó, revisar si TODOS los documentos del conductor están aprobados
    # En ese caso, activamos el rol DRIVER oficialmente
    if payload.verification_status == 'APPROVED':
        todos_docs = db.query(models.Document).filter(
            models.Document.user_id == documento.user_id
        ).all()

        todos_aprobados = all(d.verification_status == 'APPROVED' for d in todos_docs)

        if todos_aprobados:
            conductor = db.query(models.User).filter(
                models.User.user_id == documento.user_id
            ).first()
            if conductor:
                conductor.role = 'DRIVER'
                conductor.status = 'ACTIVE'
                db.commit()

    return {
        "message": f"Documento {payload.verification_status.lower()} correctamente.",
        "document_id": documento.document_id,
        "nuevo_estado": documento.verification_status
    }

# --- GET /admin/drivers/{user_id}/documents ---
# Ver todos los documentos de un conductor específico
@router.get("/drivers/{user_id}/documents", response_model=List[DocumentOut])
def get_driver_documents(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    conductor = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Conductor no encontrado.")

    documentos = db.query(models.Document).filter(
        models.Document.user_id == user_id
    ).all()

    return documentos