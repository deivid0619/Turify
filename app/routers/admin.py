import os
import httpx
import cloudinary
import cloudinary.utils
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

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

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
    if payload.verification_status not in ['APPROVED', 'REJECTED']:
        raise HTTPException(status_code=400, detail="Estado inválido. Use 'APPROVED' o 'REJECTED'.")

    documento = db.query(models.Document).filter(
        models.Document.document_id == document_id
    ).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    documento.verification_status = payload.verification_status
    db.commit()
    db.refresh(documento)

    if payload.verification_status == 'APPROVED':
        todos_docs = db.query(models.Document).filter(
            models.Document.user_id == documento.user_id
        ).all()
        if all(d.verification_status == 'APPROVED' for d in todos_docs):
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
# Proxy: descarga el archivo de Cloudinary con credenciales y lo sirve al frontend
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

    # Generar URL firmada de Cloudinary
    # Extraemos el public_id correctamente desde la URL
    try:
        # URL ejemplo: https://res.cloudinary.com/cloud_name/image/upload/v123456/turify/drivers/18/documents/soat_abc123.pdf
        if "/upload/" in url_original:
            parte_despues_upload = url_original.split("/upload/")[1]
            # Quitar version si existe (v seguido de números)
            segmentos = parte_despues_upload.split("/")
            if segmentos[0].startswith("v") and segmentos[0][1:].isdigit():
                segmentos = segmentos[1:]
            public_id_con_extension = "/".join(segmentos)

            # Para image/upload los PDFs se guardan con extensión — Cloudinary
            # necesita el public_id SIN extensión para image, CON extensión para raw
            resource_type = "raw" if "/raw/upload/" in url_original else "image"

            if resource_type == "image":
                # Quitar extensión del public_id para image resources
                if "." in public_id_con_extension:
                    public_id = public_id_con_extension.rsplit(".", 1)[0]
                else:
                    public_id = public_id_con_extension
            else:
                public_id = public_id_con_extension

            # Generar URL firmada válida por 1 hora
            url_firmada, _ = cloudinary.utils.cloudinary_url(
                public_id,
                resource_type=resource_type,
                type="upload",
                sign_url=True,
                secure=True
            )
        else:
            url_firmada = url_original

    except Exception as e:
        # Si falla la firma, usar la URL original directamente
        url_firmada = url_original

    # Descargar el archivo y reenviarlo al frontend
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            respuesta = await client.get(url_firmada)

            # Si la URL firmada falla, intentar con la original
            if respuesta.status_code != 200:
                respuesta = await client.get(url_original)

            if respuesta.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Cloudinary devolvió {respuesta.status_code}"
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