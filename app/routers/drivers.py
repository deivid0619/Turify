from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.security import get_current_user
import os
import shutil

router = APIRouter(prefix="/drivers", tags=["Modo Conductor"])

import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..security import get_current_user
from .. import models, schemas

router = APIRouter(prefix="/drivers", tags=["Modo Conductor"])

@router.post("/register-details")
async def register_driver_info(
    # 1. Datos Personales y de Empresa [cite: 21, 33, 35]
    age: int = Form(...),
    affiliated_company: int = Form(...),
    
    # 2. Datos del Vehículo [cite: 21, 37, 38]
    plate: str = Form(...),
    capacity: int = Form(...),
    
    # 3. Archivos (Fotos y Documentación) [cite: 22, 23, 36, 39, 41]
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
    # Crear carpeta de destino única para el usuario 
    base_dir = f"static/uploads/{current_user.user_id}"
    os.makedirs(base_dir, exist_ok=True)

    # Función auxiliar para guardar archivos físicamente
    def save_file(file: UploadFile, prefix: str):
        file_path = os.path.join(base_dir, f"{prefix}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return file_path

    try:
        # A. Actualizar datos en la tabla User [cite: 33]
        user_db = db.query(models.User).filter(models.User.user_id == current_user.user_id).first()
        if not user_db:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        user_db.age = age
        user_db.affiliated_company = affiliated_company
        user_db.profile_photo_url = save_file(profile_photo, "profile")
        # Cambiamos el rol para que ahora tenga acceso a funciones de conductor
        user_db.role = 'DRIVER'

        # B. Crear registro en la tabla Vehicle [cite: 37, 38]
        new_vehicle = models.Vehicle(
            owner_id=current_user.user_id,
            company_id=affiliated_company,
            plate=plate.upper(), # Normalizar placa a mayúsculas
            capacity=capacity,
            photo_url=save_file(vehicle_photo, "vehicle")
        )
        db.add(new_vehicle)

        # C. Crear registros en la tabla Document (Mapeo exacto al ENUM del SQL) [cite: 39, 41]
        # IMPORTANTE: Los nombres deben ser idénticos al schema.sql
        docs_to_save = [
            ("SOAT", doc_soat),
            ("Licencia de Conduccion", doc_licencia),
            ("Tarjeta de operacion", doc_tarjeta_operacion),
            ("Tecnomecanica", doc_tecnomecanica),
            ("Seguros Contractual y extracontractual", doc_seguros)
        ]

        for doc_type, file_obj in docs_to_save:
            db_doc = models.Document(
                user_id=current_user.user_id,
                document_type=doc_type,
                file_url=save_file(file_obj, "doc"),
                verification_status="PENDING"
            )
            db.add(db_doc)

        db.commit()
        return {"status": "success", "message": "Registro completado exitosamente"}

    except Exception as e:
        db.rollback()
        # Captura errores de base de datos como el IntegrityError (FK inexistente)
        raise HTTPException(status_code=500, detail=f"Error procesando el registro: {str(e)}")

# Endpoint adicional para que el conductor vea el estado de sus documentos
@router.get("/my-documents", response_model=List[schemas.DocumentResponse])
def get_my_documents(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Document).filter(models.Document.user_id == current_user.user_id).all()