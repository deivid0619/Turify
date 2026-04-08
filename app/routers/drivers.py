# app/routers/conductores.py
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from app import schemas, models
from app.database import get_db
from app.security import get_current_user # Dependency para autenticar
from sqlalchemy.orm import Session

router = APIRouter(prefix="/drivers", tags=["Modo Conductor"])

@router.post("/documents", response_model=schemas.DocumentResponse)
async def upload_document(
    document_type: schemas.DocumentTypeEnum, # ENUM coincidente con MySQL
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Obtenemos el ID del JWT
):
    # PASO 1: Subir el archivo al Storage (SIMULADO)
    try:
        # En producción, aquí va la integración con AWS S3/Firebase
        # storage_service.upload(file)
        simulated_file_url = f"https://storage.turify.com/docs/{current_user.full_name}_{document_type.value}.pdf"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {str(e)}")

    # PASO 2: Guardar el enlace en MySQL
    new_doc = models.Document(
        user_id=current_user.user_id,
        document_type=document_type.value,
        file_url=simulated_file_url
        # verification_status nace PENDING por defecto
    )
    
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc