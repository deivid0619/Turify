import httpx
from dotenv import load_dotenv

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.security import get_current_user
from app import models
from app.audit import registrar_log

load_dotenv()

router = APIRouter(prefix="/admin", tags=["Admin"])

# --- Schemas locales ---
class DocumentVerifyRequest(BaseModel):
    verification_status: str  # 'APPROVED' | 'REJECTED'
    # HU38 — el admin puede corregir/confirmar los años de experiencia declarados
    # al aprobar un documento RUNT. Se ignora para cualquier otro tipo de documento.
    years_experience: int | None = None

class DocumentOut(BaseModel):
    document_id: int
    document_type: str
    file_url: str
    verification_status: str
    years_experience: int | None = None
    license_categories: str | None = None

    class Config:
        from_attributes = True

class DriverPendingOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    phone_number: str
    profile_photo_url: str | None
    role: str
    conductor_verificado: bool = False
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
@router.get("/drivers/pending", response_model=List[DriverPendingOut])
def get_pending_drivers(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    usuarios = (
        db.query(models.User)
        .join(models.Document, models.Document.user_id == models.User.user_id)
        .filter(models.Document.verification_status == 'PENDING')
        .distinct()
        .all()
    )
    return usuarios

# --- PATCH /admin/documents/{document_id}/verify ---
@router.patch("/documents/{document_id}/verify")
def verify_document(
    document_id: int,
    payload: DocumentVerifyRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    if payload.verification_status not in ['APPROVED', 'REJECTED', 'PENDING']:
        raise HTTPException(status_code=400, detail="Estado inválido. Use 'APPROVED', 'REJECTED' o 'PENDING'.")

    documento = db.query(models.Document).filter(
        models.Document.document_id == document_id
    ).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    # HU38 — si el admin corrige los años de experiencia al revisar un RUNT
    if documento.document_type == 'RUNT' and payload.years_experience is not None:
        documento.years_experience = payload.years_experience

    documento.verification_status = payload.verification_status
    db.commit()
    db.refresh(documento)

    if documento.document_type == 'RUNT':
        # HU38 — el RUNT es opcional y posterior al registro: no toca el rol DRIVER,
        # solo activa/desactiva el badge de "conductor verificado".
        conductor = db.query(models.User).filter(
            models.User.user_id == documento.user_id
        ).first()
        if conductor:
            conductor.conductor_verificado = (payload.verification_status == 'APPROVED')
            db.commit()
    elif payload.verification_status == 'APPROVED':
        # Documentos obligatorios de registro (sin contar el RUNT) — activar el rol
        # DRIVER solo cuando todos estén aprobados.
        docs_obligatorios = db.query(models.Document).filter(
            models.Document.user_id == documento.user_id,
            models.Document.document_type != 'RUNT'
        ).all()
        if docs_obligatorios and all(d.verification_status == 'APPROVED' for d in docs_obligatorios):
            conductor = db.query(models.User).filter(
                models.User.user_id == documento.user_id
            ).first()
            if conductor:
                conductor.role = 'DRIVER'
                conductor.status = 'ACTIVE'
                db.commit()

    # Log de verificación de documento
    registrar_log(
        db,
        action="VERIFY_DOCUMENT",
        user_id=admin.user_id,
        entity="Document",
        entity_id=documento.document_id,
        detail=f"Documento {documento.document_type} {payload.verification_status.lower()} para usuario #{documento.user_id}"
    )

    return {
        "message": f"Documento {payload.verification_status.lower()} correctamente.",
        "document_id": documento.document_id,
        "nuevo_estado": documento.verification_status
    }

# --- GET /admin/drivers/{user_id}/documents ---
@router.get("/drivers/{user_id}/documents", response_model=List[DocumentOut])
def get_driver_documents(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    conductor = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Conductor no encontrado.")
    return db.query(models.Document).filter(models.Document.user_id == user_id).all()

# --- GET /admin/documents/{document_id}/file ---
# Proxy: descarga el archivo desde su URL (Supabase Storage) y lo sirve al frontend
@router.get("/documents/{document_id}/file")
async def proxy_documento(
    document_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    documento = db.query(models.Document).filter(
        models.Document.document_id == document_id
    ).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    url_original = documento.file_url

    # Descargar el archivo (Document.file_url ya es una URL firmada de Supabase Storage,
    # no necesita firmarse aparte como pasaba con Cloudinary) y reenviarlo al frontend
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            respuesta = await client.get(url_original)

            if respuesta.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"El almacenamiento devolvió {respuesta.status_code}"
                )

        # Determinar content-type
        content_type = respuesta.headers.get("content-type", "application/pdf")
        if url_original.lower().endswith(".pdf"):
            content_type = "application/pdf"

        return Response(
            content=respuesta.content,
            media_type=content_type,
            headers={"Content-Disposition": "inline"}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error descargando documento: {str(e)}")

# --- GET /admin/logs ---
# Vista de auditoría para el admin
@router.get("/logs")
def get_audit_logs(
    limit: int = 100,
    action: str = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    query = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc())
    if action:
        query = query.filter(models.AuditLog.action == action)
    logs = query.limit(limit).all()

    return [
        {
            "log_id": l.log_id,
            "user_id": l.user_id,
            "action": l.action,
            "entity": l.entity,
            "entity_id": l.entity_id,
            "detail": l.detail,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in logs
    ]