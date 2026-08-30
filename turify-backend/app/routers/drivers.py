import os
import uuid
from io import BytesIO
from dotenv import load_dotenv

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List
from supabase import create_client, Client

from app.database import get_db
from app.security import get_current_user
from app import models, schemas

load_dotenv()

# ── Supabase Storage client ──────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # service_role key (no anon)

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase no configurado. Verifica SUPABASE_URL y SUPABASE_SERVICE_KEY en el .env"
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Tipos MIME permitidos ────────────────────────────────────────────────────
TIPOS_PERMITIDOS = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
TAMANO_MAXIMO_MB = 5

router = APIRouter(prefix="/drivers", tags=["Modo Conductor"])


def validar_archivo(file: UploadFile) -> str:
    """Valida tipo MIME y devuelve la extensión. Lanza HTTPException si no es válido."""
    content_type = file.content_type or ""
    if content_type not in TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {content_type}. Solo se aceptan PDF, JPG, PNG y WEBP."
        )
    return TIPOS_PERMITIDOS[content_type]


async def upload_to_supabase(
    supabase: Client,
    file: UploadFile,
    bucket: str,
    path: str,
) -> str:
    """
    Sube un archivo a Supabase Storage y devuelve la URL firmada (expira en 15 min).
    Para acceso permanente del admin se usa signed URL con TTL largo.
    """
    ext = validar_archivo(file)

    # Leer contenido y validar tamaño
    contenido = await file.read()
    tamano_mb = len(contenido) / (1024 * 1024)
    if tamano_mb > TAMANO_MAXIMO_MB:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo supera el límite de {TAMANO_MAXIMO_MB}MB ({tamano_mb:.1f}MB)."
        )

    file_path = f"{path}/{uuid.uuid4()}.{ext}"

    try:
        supabase.storage.from_(bucket).upload(
            path=file_path,
            file=contenido,
            file_options={"content-type": file.content_type}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo archivo a Supabase: {str(e)}")

    # URL firmada con 1 año de validez para documentos legales
    try:
        signed = supabase.storage.from_(bucket).create_signed_url(file_path, expires_in=31536000)
        return signed["signedURL"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando URL firmada: {str(e)}")


@router.post("/register-details")
async def register_driver_info(
    age: int = Form(...),
    affiliated_company: int = Form(...),
    plate: str = Form(...),
    capacity: int = Form(...),
    profile_photo: UploadFile = File(...),
    vehicle_photo: UploadFile = File(...),
    doc_soat: UploadFile = File(...),
    doc_licencia: UploadFile = File(...),
    doc_tarjeta_operacion: UploadFile = File(...),
    doc_tecnomecanica: UploadFile = File(...),
    doc_seguros: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # ── Bloquear si ya tiene documentos PENDING o APPROVED ───────────────────
    docs_existentes = db.query(models.Document).filter(
        models.Document.user_id == current_user.user_id,
        models.Document.verification_status.in_(["PENDING", "APPROVED"])
    ).first()

    if docs_existentes:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes documentos enviados. Debes esperar la revisión del administrador o tener documentos rechazados para volver a enviar."
        )

    supabase = get_supabase()
    base_path = f"drivers/{current_user.user_id}"

    try:
        # A. Actualizar datos del usuario
        user_db = db.query(models.User).filter(
            models.User.user_id == current_user.user_id
        ).first()
        if not user_db:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        user_db.age = age
        user_db.affiliated_company = affiliated_company
        user_db.profile_photo_url = await upload_to_supabase(
            supabase, profile_photo, "turify-fotos", f"{base_path}/profile"
        )

        # B. Vehículo — solo si no tiene uno ya
        vehiculo_existente = db.query(models.Vehicle).filter(
            models.Vehicle.owner_id == current_user.user_id
        ).first()

        if not vehiculo_existente:
            vehicle_photo_url = await upload_to_supabase(
                supabase, vehicle_photo, "turify-fotos", f"{base_path}/vehicle"
            )
            new_vehicle = models.Vehicle(
                owner_id=current_user.user_id,
                company_id=affiliated_company,
                plate=plate.upper(),
                capacity=capacity,
                photo_url=vehicle_photo_url
            )
            db.add(new_vehicle)

        # C. Documentos legales → bucket privado con URLs firmadas
        docs_to_save = [
            ("SOAT",                                    doc_soat,              "soat"),
            ("Licencia de Conduccion",                  doc_licencia,          "licencia"),
            ("Tarjeta de operacion",                    doc_tarjeta_operacion, "tarjeta_operacion"),
            ("Tecnomecanica",                           doc_tecnomecanica,     "tecnomecanica"),
            ("Seguros Contractual y extracontractual",  doc_seguros,           "seguros"),
        ]

        for doc_type, file_obj, nombre_clave in docs_to_save:
            doc_previo = db.query(models.Document).filter(
                models.Document.user_id == current_user.user_id,
                models.Document.document_type == doc_type
            ).first()

            if doc_previo and doc_previo.verification_status in ["PENDING", "APPROVED"]:
                continue  # Ya existe y no fue rechazado, no tocar

            secure_url = await upload_to_supabase(
                supabase, file_obj, "turify-documentos", f"{base_path}/{nombre_clave}"
            )

            if doc_previo:
                # Era rechazado — actualizar con el nuevo archivo
                doc_previo.file_url = secure_url
                doc_previo.verification_status = "PENDING"
                doc_previo.ai_extracted_data = None
                doc_previo.ai_confidence = None
                doc_previo.ai_observations = None
            else:
                db.add(models.Document(
                    user_id=current_user.user_id,
                    document_type=doc_type,
                    file_url=secure_url,
                    verification_status="PENDING"
                ))

        db.commit()
        return {
            "status": "success",
            "message": "Documentos enviados exitosamente. El administrador los revisará pronto."
        }

    except HTTPException as http_exc:
        db.rollback()
        raise http_exc
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error procesando el registro: {str(e)}")


@router.get("/my-documents", response_model=List[schemas.DocumentResponse])
def get_my_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Document).filter(
        models.Document.user_id == current_user.user_id
    ).all()


@router.get("/registration-status")
def get_registration_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    documentos = db.query(models.Document).filter(
        models.Document.user_id == current_user.user_id
    ).all()

    if not documentos:
        return {"estado": "SIN_DOCUMENTOS", "mensaje": "No has enviado documentos aún."}

    estados = [d.verification_status for d in documentos]

    if all(e == "APPROVED" for e in estados):
        return {
            "estado": "APROBADO",
            "mensaje": "Todos tus documentos han sido aprobados. ¡Ya eres conductor!"
        }

    if any(e == "REJECTED" for e in estados):
        docs_rechazados = [d.document_type for d in documentos if d.verification_status == "REJECTED"]
        return {
            "estado": "RECHAZADO",
            "mensaje": "Algunos documentos fueron rechazados. Puedes volver a enviarlos.",
            "documentos_rechazados": docs_rechazados
        }

    return {
        "estado": "PENDIENTE",
        "mensaje": "Tus documentos están siendo revisados por el administrador.",
        "documentos": [
            {"tipo": d.document_type, "estado": d.verification_status}
            for d in documentos
        ]
    }

# ── HU09 — Rango geográfico de conductores ──────────────────────────────────
@router.patch("/location")
def update_driver_location(
    payload: schemas.DriverLocationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Permite al conductor actualizar su posición actual (current_lat/current_lng)
    y su estado online/offline. El frontend del conductor debe llamar este
    endpoint periódicamente mientras esté disponible/en viaje (Supabase Realtime
    hace el resto en el lado de Supabase, pero la fuente de verdad la
    actualizamos por este endpoint estándar de FastAPI).
    """
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden actualizar su ubicación.")

    if payload.current_lat is not None:
        current_user.current_lat = payload.current_lat
    if payload.current_lng is not None:
        current_user.current_lng = payload.current_lng
    if payload.is_online is not None:
        current_user.is_online = payload.is_online

    db.commit()
    db.refresh(current_user)

    return {
        "current_lat": float(current_user.current_lat) if current_user.current_lat is not None else None,
        "current_lng": float(current_user.current_lng) if current_user.current_lng is not None else None,
        "is_online": current_user.is_online,
    }
