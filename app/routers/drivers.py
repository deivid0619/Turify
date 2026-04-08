from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.security import get_current_user

router = APIRouter(prefix="/drivers", tags=["Modo Conductor"])

@router.post("/documents", response_model=schemas.DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    # Usamos Form() porque cuando se envían archivos, el frontend usa 'multipart/form-data'
    document_type: schemas.DocumentTypeEnum = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # El guardia de seguridad
):
    """
    Sube un documento para el Modo Conductor.
    Requiere que el usuario envíe su Token JWT.
    """
    # 1. Validación de seguridad: Solo permitir PDFs o Imágenes
    if not file.filename.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF, JPG o PNG.")

    # 2. Simulación de subida al servidor (AWS S3, Firebase, etc.)
    # Aquí es donde el archivo físico iría a la nube. Simulamos la URL resultante:
    nombre_seguro = document_type.value.replace(" ", "_").lower()
    simulated_file_url = f"https://storage.turify.com/docs/user{current_user.user_id}_{nombre_seguro}.pdf"

    # 3. Validar si el usuario ya había subido este documento antes
    existing_doc = db.query(models.Document).filter(
        models.Document.user_id == current_user.user_id,
        models.Document.document_type == document_type.value
    ).first()

    if existing_doc:
        # Si ya lo había subido (y tal vez se lo rechazaron), lo actualizamos
        existing_doc.file_url = simulated_file_url
        existing_doc.verification_status = "PENDING" # Vuelve a estar pendiente de revisión
        db.commit()
        db.refresh(existing_doc)
        return existing_doc

    # 4. Si es nuevo, lo guardamos en la base de datos MySQL
    new_doc = models.Document(
        user_id=current_user.user_id,
        document_type=document_type.value,
        file_url=simulated_file_url
        # verification_status nace como PENDING automáticamente
    )
    
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    return new_doc


@router.get("/documents", response_model=list[schemas.DocumentResponse])
def get_my_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Devuelve la lista de documentos que ha subido el usuario logueado 
    y muestra si están PENDING, APPROVED o REJECTED.
    """
    documents = db.query(models.Document).filter(models.Document.user_id == current_user.user_id).all()
    return documents