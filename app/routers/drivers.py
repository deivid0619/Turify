import os
import uuid
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.security import get_current_user
from app import models, schemas

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

router = APIRouter(prefix="/drivers", tags=["Modo Conductor"])

def detectar_extension(file: UploadFile) -> str:
    """
    Detecta la extensión real del archivo usando content_type y filename.
    Si no se puede detectar, asume pdf.
    """
    content_type = file.content_type or ""
    filename = file.filename or ""

    # Por content_type
    mapa_content_type = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
    }
    if content_type in mapa_content_type:
        return mapa_content_type[content_type]

    # Por extensión del filename
    if "." in filename:
        ext = filename.rsplit(".", 1)[1].lower()
        if ext in ["pdf", "jpg", "jpeg", "png", "webp", "heic"]:
            return ext

    # Por defecto asumimos pdf para documentos legales
    return "pdf"

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
    # --- VALIDACIÓN: bloquear si ya tiene documentos PENDING o APPROVED ---
    docs_existentes = db.query(models.Document).filter(
        models.Document.user_id == current_user.user_id,
        models.Document.verification_status.in_(["PENDING", "APPROVED"])
    ).first()

    if docs_existentes:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes documentos enviados. Debes esperar la revisión del administrador o tener documentos rechazados para volver a enviar."
        )

    def upload_foto(file: UploadFile, folder_path: str) -> str:
        """Sube fotos de perfil y vehículo como imagen normal."""
        try:
            result = cloudinary.uploader.upload(
                file.file,
                folder=folder_path,
                resource_type="image"
            )
            return result.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error subiendo foto: {str(e)}")

    def upload_documento(file: UploadFile, folder_path: str, nombre_doc: str) -> str:
        """
        Sube documentos como image/upload para que Cloudinary
        pueda renderizarlos directamente en el navegador (preview).
        """
        try:
            result = cloudinary.uploader.upload(
                file.file,
                folder=folder_path,
                resource_type="image",
                use_filename=True,
                unique_filename=True
            )
            return result.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error subiendo documento '{nombre_doc}': {str(e)}")

    cloud_folder = f"turify/drivers/{current_user.user_id}"

    try:
        # A. Actualizar datos del usuario
        user_db = db.query(models.User).filter(
            models.User.user_id == current_user.user_id
        ).first()
        if not user_db:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        user_db.age = age
        user_db.affiliated_company = affiliated_company
        user_db.profile_photo_url = upload_foto(profile_photo, f"{cloud_folder}/profile")
        # El rol sigue siendo PASSENGER hasta que el admin apruebe todos los documentos

        # B. Vehículo — solo si no tiene uno ya
        vehiculo_existente = db.query(models.Vehicle).filter(
            models.Vehicle.owner_id == current_user.user_id
        ).first()

        if not vehiculo_existente:
            new_vehicle = models.Vehicle(
                owner_id=current_user.user_id,
                company_id=affiliated_company,
                plate=plate.upper(),
                capacity=capacity,
                photo_url=upload_foto(vehicle_photo, f"{cloud_folder}/vehicle")
            )
            db.add(new_vehicle)

        # C. Documentos legales — subidos como image para permitir preview en el admin
        docs_to_save = [
            ("SOAT",                                   doc_soat,               "soat"),
            ("Licencia de Conduccion",                 doc_licencia,           "licencia"),
            ("Tarjeta de operacion",                   doc_tarjeta_operacion,  "tarjeta_operacion"),
            ("Tecnomecanica",                          doc_tecnomecanica,      "tecnomecanica"),
            ("Seguros Contractual y extracontractual", doc_seguros,            "seguros"),
        ]

        for doc_type, file_obj, nombre_clave in docs_to_save:
            doc_previo = db.query(models.Document).filter(
                models.Document.user_id == current_user.user_id,
                models.Document.document_type == doc_type
            ).first()

            if doc_previo and doc_previo.verification_status in ["PENDING", "APPROVED"]:
                continue  # Ya existe y no fue rechazado, no tocar

            secure_url = upload_documento(file_obj, f"{cloud_folder}/documents", nombre_clave)

            if doc_previo:
                # Era rechazado — actualizar con el nuevo archivo
                doc_previo.file_url = secure_url
                doc_previo.verification_status = "PENDING"
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
    """
    El frontend usa este endpoint para saber si mostrar el formulario
    o el estado actual de los documentos del conductor.
    """
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