import os
import uuid
from io import BytesIO
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
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

# ── HU55 — Categorías de vehículo y rango estándar de tarifa por km ─────────
# Rangos en COP/km, orientativos — el conductor puede moverse dentro de su
# categoría pero no salirse de ella (evita tarifas absurdas por error).
RANGOS_CATEGORIA = [
    (1, 4,   "SEDAN",      (1500, 3000)),
    (5, 10,  "VAN",        (2000, 4000)),
    (11, 19, "MICROBUS",   (2500, 5000)),
    (20, 35, "BUS",        (3000, 6000)),
    (36, 60, "BUS_GRANDE", (3500, 7000)),
]


def calcular_categoria(capacidad: int) -> str:
    for minimo, maximo, categoria, _ in RANGOS_CATEGORIA:
        if minimo <= capacidad <= maximo:
            return categoria
    return "BUS_GRANDE" if capacidad > 60 else "SEDAN"


def rango_tarifa_km(categoria: str):
    for _, _, cat, rango in RANGOS_CATEGORIA:
        if cat == categoria:
            return list(rango)
    return [1500, 3000]


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
    # HU55 — comodidades del vehículo, opcionales desde el registro (el conductor
    # puede dejarlas todas sin marcar y configurarlas después en su panel).
    tiene_ac: bool = Form(False),
    tiene_wifi: bool = Form(False),
    tiene_bano: bool = Form(False),
    tiene_musica: bool = Form(False),
    tiene_maletero_amplio: bool = Form(False),
    tiene_sillas_bebe: bool = Form(False),
    tiene_sillas_reclinables: bool = Form(False),
    tiene_cargador_usb: bool = Form(False),
    tiene_tv: bool = Form(False),
    tiene_buen_audio: bool = Form(False),
    acepta_mascotas: bool = Form(False),
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
                photo_url=vehicle_photo_url,
                # HU55 — comodidades declaradas desde el registro (opcionales)
                tiene_ac=tiene_ac,
                tiene_wifi=tiene_wifi,
                tiene_bano=tiene_bano,
                tiene_musica=tiene_musica,
                tiene_maletero_amplio=tiene_maletero_amplio,
                tiene_sillas_bebe=tiene_sillas_bebe,
                tiene_sillas_reclinables=tiene_sillas_reclinables,
                tiene_cargador_usb=tiene_cargador_usb,
                tiene_tv=tiene_tv,
                tiene_buen_audio=tiene_buen_audio,
                acepta_mascotas=acepta_mascotas,
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


# ── HU37 — Subida de documento RUNT (SCRUM-183) ─────────────────────────────
# A diferencia de los 5 documentos obligatorios de /register-details, el RUNT es
# opcional y se sube DESPUÉS del registro, para declarar/verificar años de
# experiencia. No afecta el rol DRIVER ya activo — solo habilita el badge de
# "conductor verificado" (HU38) cuando el admin lo aprueba.
@router.post("/upload-runt")
async def upload_runt(
    years_experience: int = Form(...),
    license_categories: str = Form(None),
    doc_runt: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden subir el RUNT.")

    if years_experience < 0 or years_experience > 80:
        raise HTTPException(status_code=400, detail="Los años de experiencia declarados no son válidos.")

    runt_activo = db.query(models.Document).filter(
        models.Document.user_id == current_user.user_id,
        models.Document.document_type == "RUNT",
        models.Document.verification_status.in_(["PENDING", "APPROVED"])
    ).first()
    if runt_activo:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes un RUNT enviado. Espera la revisión del administrador, o a que sea rechazado para volver a enviarlo."
        )

    supabase = get_supabase()
    base_path = f"drivers/{current_user.user_id}"
    secure_url = await upload_to_supabase(supabase, doc_runt, "turify-documentos", f"{base_path}/runt")

    runt_previo = db.query(models.Document).filter(
        models.Document.user_id == current_user.user_id,
        models.Document.document_type == "RUNT"
    ).first()

    if runt_previo:
        # Era rechazado — se reenvía con el nuevo archivo y datos
        runt_previo.file_url = secure_url
        runt_previo.verification_status = "PENDING"
        runt_previo.years_experience = years_experience
        runt_previo.license_categories = license_categories
        runt_previo.ai_extracted_data = None
        runt_previo.ai_confidence = None
        runt_previo.ai_observations = None
    else:
        db.add(models.Document(
            user_id=current_user.user_id,
            document_type="RUNT",
            file_url=secure_url,
            verification_status="PENDING",
            years_experience=years_experience,
            license_categories=license_categories
        ))

    db.commit()
    return {
        "status": "success",
        "message": "RUNT enviado correctamente. El administrador revisará tu experiencia pronto."
    }


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

# ── HU26 — Rango geográfico de conductores ──────────────────────────────────
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


# ── HU55 — Comodidades, capacidad real y tarifas del vehículo (SCRUM-207) ───
@router.get("/vehicle", response_model=schemas.VehicleSettingsResponse)
def get_my_vehicle(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores tienen vehículo registrado.")

    vehiculo = db.query(models.Vehicle).filter(
        models.Vehicle.owner_id == current_user.user_id
    ).first()
    if not vehiculo:
        raise HTTPException(status_code=404, detail="Aún no tienes un vehículo registrado. Completa tu registro de conductor primero.")

    capacidad_para_categoria = vehiculo.capacidad_real or vehiculo.capacity
    categoria = calcular_categoria(capacidad_para_categoria)

    return {
        "vehicle_id": vehiculo.vehicle_id,
        "plate": vehiculo.plate,
        "capacity": vehiculo.capacity,
        "capacidad_real": vehiculo.capacidad_real,
        "categoria": categoria,
        "tarifa_km_base": float(vehiculo.tarifa_km_base) if vehiculo.tarifa_km_base is not None else None,
        "tarifa_km_rango": rango_tarifa_km(categoria),
        "tarifa_espera_hora": float(vehiculo.tarifa_espera_hora) if vehiculo.tarifa_espera_hora is not None else None,
        "tarifa_dia": float(vehiculo.tarifa_dia) if vehiculo.tarifa_dia is not None else None,
        "km_incluidos_por_dia": vehiculo.km_incluidos_por_dia,
        "recargo_dificil_acceso": float(vehiculo.recargo_dificil_acceso) if vehiculo.recargo_dificil_acceso is not None else None,
        "tiene_ac": vehiculo.tiene_ac,
        "tiene_wifi": vehiculo.tiene_wifi,
        "tiene_bano": vehiculo.tiene_bano,
        "tiene_musica": vehiculo.tiene_musica,
        "tiene_maletero_amplio": vehiculo.tiene_maletero_amplio,
        "tiene_sillas_bebe": vehiculo.tiene_sillas_bebe,
        "tiene_sillas_reclinables": vehiculo.tiene_sillas_reclinables,
        "tiene_cargador_usb": vehiculo.tiene_cargador_usb,
        "tiene_tv": vehiculo.tiene_tv,
        "tiene_buen_audio": vehiculo.tiene_buen_audio,
        "acepta_mascotas": vehiculo.acepta_mascotas,
        "cargo_mascota": float(vehiculo.cargo_mascota) if vehiculo.cargo_mascota is not None else None,
        "acepta_menores_2_anos": vehiculo.acepta_menores_2_anos,
    }


@router.patch("/vehicle", response_model=schemas.VehicleSettingsResponse)
def update_my_vehicle(
    payload: schemas.VehicleSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden editar su vehículo.")

    vehiculo = db.query(models.Vehicle).filter(
        models.Vehicle.owner_id == current_user.user_id
    ).first()
    if not vehiculo:
        raise HTTPException(status_code=404, detail="Aún no tienes un vehículo registrado. Completa tu registro de conductor primero.")

    datos = payload.model_dump(exclude_unset=True)

    if "cargo_mascota" in datos and datos["cargo_mascota"] > 0 and datos.get("acepta_mascotas", vehiculo.acepta_mascotas) is False:
        raise HTTPException(status_code=400, detail="No puedes configurar un cargo por mascota si no aceptas mascotas.")

    for campo, valor in datos.items():
        setattr(vehiculo, campo, valor)

    db.commit()
    db.refresh(vehiculo)

    return get_my_vehicle(db=db, current_user=current_user)


# ── HU52 — Panel de ganancias del conductor (SCRUM-204) ─────────────────────
@router.get("/earnings")
def get_driver_earnings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Resumen de ganancias y rendimiento del conductor autenticado: ganancias de
    la semana y el mes (suma del precio aceptado de sus viajes COMPLETED),
    número total de viajes completados, horarios más activos (conteo por hora
    del día) y sus 3 rutas más frecuentes.

    La "calificación promedio" del criterio de aceptación queda pendiente:
    todavía no existe HU46 (Calificaciones bidireccionales / SCRUM-194), así
    que el frontend debe mostrar "Próximamente" para ese dato por ahora.
    """
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden ver su panel de ganancias.")

    # departure_time es TIMESTAMP(timezone=True): la base devuelve fechas CON zona.
    # Con datetime.utcnow() (sin zona) la comparación de más abajo reventaba con
    # "can't compare offset-naive and offset-aware datetimes", y como el error subía
    # sin manejar, FastAPI respondía 500 SIN las cabeceras de CORS: el navegador lo
    # veía como fallo de red y la pestaña solo decía "no pudimos conectarnos".
    ahora = datetime.now(timezone.utc)
    inicio_semana = ahora - timedelta(days=7)
    inicio_mes = ahora - timedelta(days=30)

    # Viajes completados de este conductor, con el precio que realmente se aceptó
    # (DriverOffer.status == ACCEPTED es el precio final del viaje, no offered_price
    # de ofertas rechazadas/contraofertadas).
    viajes = (
        db.query(
            models.ServiceRequest.request_id,
            models.ServiceRequest.origin,
            models.ServiceRequest.destination,
            models.ServiceRequest.departure_time,
            models.DriverOffer.offered_price,
        )
        .join(models.DriverOffer, models.DriverOffer.request_id == models.ServiceRequest.request_id)
        .filter(
            models.ServiceRequest.status == "COMPLETED",
            models.DriverOffer.driver_id == current_user.user_id,
            models.DriverOffer.status == "ACCEPTED",
        )
        .all()
    )

    ganancias_semana = 0.0
    ganancias_mes = 0.0
    horarios = [0] * 24
    rutas = {}

    for v in viajes:
        precio = float(v.offered_price or 0)
        fecha = v.departure_time
        # Cinturón y tirantes: si alguna fila llegara sin zona (SQLite en pruebas,
        # o un dato viejo), se asume UTC en vez de tumbar la pestaña entera.
        if fecha is not None and fecha.tzinfo is None:
            fecha = fecha.replace(tzinfo=timezone.utc)
        if fecha and fecha >= inicio_semana:
            ganancias_semana += precio
        if fecha and fecha >= inicio_mes:
            ganancias_mes += precio
        if fecha:
            horarios[fecha.hour] += 1
        ruta = f"{v.origin} → {v.destination}"
        rutas[ruta] = rutas.get(ruta, 0) + 1

    top_rutas = sorted(rutas.items(), key=lambda x: x[1], reverse=True)[:3]

    # HU46 — ahora que existen calificaciones reales (Rating), las usamos aquí
    fila_rating = db.query(
        func.avg(models.Rating.score),
        func.count(models.Rating.rating_id)
    ).filter(models.Rating.rated_id == current_user.user_id).first()
    promedio_rating, cantidad_rating = fila_rating
    calificacion_promedio = round(float(promedio_rating), 1) if promedio_rating is not None else None

    return {
        "ganancias_semana": round(ganancias_semana, 2),
        "ganancias_mes": round(ganancias_mes, 2),
        "viajes_completados": len(viajes),
        "calificacion_promedio": calificacion_promedio,
        "calificacion_cantidad": cantidad_rating or 0,
        "horarios_activos": horarios,   # conteo de viajes por hora del día (0-23)
        "top_rutas": [{"ruta": r, "viajes": c} for r, c in top_rutas],
    }


# ── HU38 — Perfil público del conductor (lo ve el pasajero desde una oferta) ─
@router.get("/{driver_id}/public-profile")
def get_driver_public_profile(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    conductor = db.query(models.User).filter(
        models.User.user_id == driver_id,
        models.User.role == "DRIVER"
    ).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Conductor no encontrado.")

    fila_rating = db.query(
        func.avg(models.Rating.score),
        func.count(models.Rating.rating_id)
    ).filter(models.Rating.rated_id == driver_id).first()
    promedio, cantidad = fila_rating
    rating_avg = round(float(promedio), 1) if promedio is not None else None

    viajes_completados = (
        db.query(models.ServiceRequest.request_id)
        .join(models.DriverOffer, models.DriverOffer.request_id == models.ServiceRequest.request_id)
        .filter(
            models.ServiceRequest.status == "COMPLETED",
            models.DriverOffer.driver_id == driver_id,
            models.DriverOffer.status == "ACCEPTED",
        )
        .count()
    )

    vehiculo = db.query(models.Vehicle).filter(models.Vehicle.owner_id == driver_id).first()
    vehiculo_out = None
    if vehiculo:
        capacidad = vehiculo.capacidad_real or vehiculo.capacity
        vehiculo_out = {
            "plate": vehiculo.plate,
            "capacity": capacidad,
            "categoria": calcular_categoria(capacidad),
            "tiene_ac": vehiculo.tiene_ac,
            "tiene_wifi": vehiculo.tiene_wifi,
            "tiene_bano": vehiculo.tiene_bano,
            "tiene_musica": vehiculo.tiene_musica,
            "tiene_maletero_amplio": vehiculo.tiene_maletero_amplio,
            "tiene_sillas_bebe": vehiculo.tiene_sillas_bebe,
            "tiene_sillas_reclinables": vehiculo.tiene_sillas_reclinables,
            "tiene_cargador_usb": vehiculo.tiene_cargador_usb,
            "tiene_tv": vehiculo.tiene_tv,
            "tiene_buen_audio": vehiculo.tiene_buen_audio,
            "acepta_mascotas": vehiculo.acepta_mascotas,
        }

    empresa = None
    if conductor.affiliated_company:
        emp = db.query(models.AffiliatedCompany).filter(
            models.AffiliatedCompany.company_id == conductor.affiliated_company
        ).first()
        if emp:
            empresa = {"name": emp.name}

    # El dato solo se expone si el RUNT está aprobado — es lo que respalda el sello
    years_experience = None
    if conductor.conductor_verificado:
        runt = db.query(models.Document).filter(
            models.Document.user_id == driver_id,
            models.Document.document_type == "RUNT",
            models.Document.verification_status == "APPROVED"
        ).first()
        if runt:
            years_experience = runt.years_experience

    return {
        "user_id": conductor.user_id,
        "full_name": conductor.full_name,
        "profile_photo_url": conductor.profile_photo_url,
        "rating_avg": rating_avg,
        "rating_count": cantidad or 0,
        "viajes_completados": viajes_completados,
        "vehiculo": vehiculo_out,
        "empresa_afiliada": empresa,
        "conductor_verificado": bool(conductor.conductor_verificado),
        "years_experience": years_experience,
    }
