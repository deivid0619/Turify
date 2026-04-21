import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.security import get_current_user
from app import models, schemas

# 1. Cargar las variables de entorno del archivo .env
load_dotenv()

# 2. Configuración oficial de Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

router = APIRouter(prefix="/drivers", tags=["Modo Conductor"])

@router.post("/register-details")
async def register_driver_info(
    # 1. Datos Personales y de Empresa
    age: int = Form(...),
    affiliated_company: int = Form(...),
    
    # 2. Datos del Vehículo
    plate: str = Form(...),
    capacity: int = Form(...),
    
    # 3. Archivos (Fotos y Documentación)
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
    # Función auxiliar para subir a Cloudinary y obtener la URL segura
    def upload_to_cloud(file: UploadFile, folder_path: str) -> str:
        try:
            # Sube el archivo directamente leyendo sus bytes a una carpeta específica
            result = cloudinary.uploader.upload(file.file, folder=folder_path)
            return result.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error subiendo archivo a la nube: {str(e)}")

    # Carpeta base en Cloudinary para mantener el orden
    cloud_folder = f"turify/drivers/{current_user.user_id}"

    try:
        # A. Actualizar datos en la tabla User
        user_db = db.query(models.User).filter(models.User.user_id == current_user.user_id).first()
        if not user_db:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        user_db.age = age
        user_db.affiliated_company = affiliated_company
        # Subir foto de perfil a la nube
        user_db.profile_photo_url = upload_to_cloud(profile_photo, f"{cloud_folder}/profile")
        user_db.role = 'DRIVER'

        # B. Crear registro en la tabla Vehicle
        new_vehicle = models.Vehicle(
            owner_id=current_user.user_id,
            company_id=affiliated_company,
            plate=plate.upper(),
            capacity=capacity,
            # Subir foto del vehículo a la nube
            photo_url=upload_to_cloud(vehicle_photo, f"{cloud_folder}/vehicle")
        )
        db.add(new_vehicle)

        # C. Crear registros en la tabla Document
        docs_to_save = [
            ("SOAT", doc_soat),
            ("Licencia de Conduccion", doc_licencia),
            ("Tarjeta de operacion", doc_tarjeta_operacion),
            ("Tecnomecanica", doc_tecnomecanica),
            ("Seguros Contractual y extracontractual", doc_seguros)
        ]

        for doc_type, file_obj in docs_to_save:
            # Subir cada documento legal a la nube
            secure_url = upload_to_cloud(file_obj, f"{cloud_folder}/documents")
            
            db_doc = models.Document(
                user_id=current_user.user_id,
                document_type=doc_type,
                file_url=secure_url,  # Guardamos el enlace de Cloudinary en MySQL
                verification_status="PENDING"
            )
            db.add(db_doc)

        db.commit()
        return {"status": "success", "message": "Registro completado exitosamente y archivos subidos a la nube"}

    except HTTPException as http_exc:
        db.rollback()
        raise http_exc
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error procesando el registro: {str(e)}")


# Endpoint adicional para que el conductor vea el estado de sus documentos
@router.get("/my-documents", response_model=List[schemas.DocumentResponse])
def get_my_documents(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Document).filter(models.Document.user_id == current_user.user_id).all()