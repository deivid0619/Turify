import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from app.database import get_db
from app import models, schemas, security # Tu lógica de seguridad
from ..security import get_current_user
from app.audit import registrar_log

router = APIRouter(prefix="/api/service-requests", tags=["Service Requests"])

from datetime import datetime
from fastapi import HTTPException, status, Depends
# Asegúrate de tener tus importaciones normales aquí...

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_service_request(
    request_data: schemas.ServiceRequestCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    # --- INICIO DE VALIDACIONES ---
    
    # 1. Validar que la fecha de salida no sea en el pasado
    # (Usamos .replace(tzinfo=None) por si el frontend envía fechas con zona horaria)
    if request_data.departure_time.replace(tzinfo=None) < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="La fecha y hora de salida no puede estar en el pasado."
        )

    # Convertimos el Enum a texto para las validaciones
    trip_type_str = request_data.trip_type.value if hasattr(request_data.trip_type, 'value') else request_data.trip_type

    # 2. Validaciones de Ida y Vuelta vs Solo Ida
    if trip_type_str == "ROUND_TRIP":
        if not request_data.return_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Para viajes de ida y vuelta (ROUND_TRIP), la fecha de regreso es obligatoria."
            )
        if request_data.return_time <= request_data.departure_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="La fecha de regreso debe ser posterior a la fecha de salida."
            )
    else:
        # Si es ONE_WAY, forzamos return_time a None
        request_data.return_time = None

    # --- FIN DE VALIDACIONES ---

    try:
        new_request = models.ServiceRequest(
            passenger_id=current_user.user_id,
            origin=request_data.origin,
            destination=request_data.destination,
            departure_time=request_data.departure_time,
            return_time=request_data.return_time,
            trip_type=trip_type_str,
            adults_count=request_data.adults_count,
            children_count=request_data.children_count,
            has_pets=request_data.has_pets,
            status="PENDING",
            # Épica 2 (HU25) — datos de ruta de Google Maps, para el motor de precio (Épica 12)
            origin_lat=request_data.origin_lat,
            origin_lng=request_data.origin_lng,
            destination_lat=request_data.destination_lat,
            destination_lng=request_data.destination_lng,
            distance_km=request_data.distance_km,
            tolls_count=request_data.tolls_count or 0,
            tolls_cost=request_data.tolls_cost or 0,
            tipo_via=request_data.tipo_via or "PAVIMENTADA",
            # HU26 — búsqueda de conductores 100% automática: ya no la elige el
            # pasajero. El centro de búsqueda es siempre el origen del viaje, y el
            # radio guardado es amplio y fijo (RADIO_VISIBILIDAD_KM) para que la
            # solicitud siga siendo visible en el radar (GET /pending) de cualquier
            # conductor que se conecte más tarde, sin importar qué tan lejos esté el
            # conductor más cercano en el momento exacto de publicar el viaje.
            search_lat=request_data.origin_lat,
            search_lng=request_data.origin_lng,
            search_radius_km=RADIO_VISIBILIDAD_KM,
            # HU55 — comodidades que el pasajero exige del vehículo
            requiere_ac=request_data.requiere_ac or False,
            requiere_wifi=request_data.requiere_wifi or False,
            requiere_bano=request_data.requiere_bano or False,
            requiere_musica=request_data.requiere_musica or False,
            requiere_maletero_amplio=request_data.requiere_maletero_amplio or False,
            requiere_sillas_bebe=request_data.requiere_sillas_bebe or False,
            requiere_acepta_mascotas=request_data.requiere_acepta_mascotas or False,
        )
        
        db.add(new_request)
        db.commit()
        db.refresh(new_request)

        # Log de creación de viaje
        registrar_log(
            db,
            action="CREATE_TRIP",
            user_id=current_user.user_id,
            entity="ServiceRequest",
            entity_id=new_request.request_id,
            detail=f"Viaje creado: {request_data.origin} → {request_data.destination}"
        )

        # HU26 — Notificar (push, vía Supabase Realtime + tabla Notification) a los
        # conductores DISPONIBLES más cercanos al origen del viaje. En vez de un
        # radio fijo elegido por el pasajero, probamos radios cada vez más amplios
        # (RADIOS_NOTIFICACION_KM) y nos quedamos con el primero que encuentre al
        # menos un conductor — así siempre se prioriza "lo más cerca posible", y si
        # no hay nadie cerca, la búsqueda se amplía sola en vez de dejar al
        # pasajero sin notificar a nadie.
        if new_request.search_lat is not None and new_request.search_lng is not None:
            # Ya no se exige is_online: los viajes son premeditados y al conductor
            # le sirve enterarse aunque no tenga la app abierta en ese momento.
            # El único requisito es tener una ubicación conocida, que es lo que
            # permite ordenar por cercanía.
            conductores_online = db.query(models.User).filter(
                models.User.role == "DRIVER",
                models.User.current_lat.isnot(None),
                models.User.current_lng.isnot(None),
            ).all()

            # HU55 — las comodidades ya NO excluyen a nadie de la notificación inicial
            # (filtro flexible): un conductor que cumple 2 de 3 comodidades pedidas
            # igual se entera del viaje y puede ofertar — el pasajero ve, al revisar
            # las ofertas, cuáles comodidades cumple cada uno y cuáles le faltan, y
            # decide con esa información. El filtro solo se usa para PRIORIZAR el
            # orden en que se notifica dentro de cada radio (primero los que más
            # coinciden), no para dejar a nadie fuera.
            conductores_a_notificar = []
            for radio in RADIOS_NOTIFICACION_KM:
                candidatos_en_radio = [
                    c for c in conductores_online
                    if _distancia_km(new_request.search_lat, new_request.search_lng, c.current_lat, c.current_lng) <= radio
                ]
                if candidatos_en_radio:
                    conductores_a_notificar = sorted(
                        candidatos_en_radio,
                        key=lambda c: -_match_comodidades(db, c, new_request)["cumplidas"]
                    )
                    break

            for conductor in conductores_a_notificar:
                crear_notificacion(
                    db,
                    user_id=conductor.user_id,
                    title="Nuevo viaje disponible cerca de ti",
                    message=f"{request_data.origin} → {request_data.destination}",
                    tipo="SYSTEM",
                )

            conductores_notificados = len(conductores_a_notificar)
        else:
            conductores_notificados = 0

        # Se agrega "conductores_notificados" a la respuesta para que el frontend
        # pueda avisarle al pasajero si, con los filtros de comodidades que eligió,
        # no había ningún conductor conectado en este momento (HU55).
        respuesta = {c.name: getattr(new_request, c.name) for c in new_request.__table__.columns}
        respuesta["conductores_notificados"] = conductores_notificados
        return respuesta

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar la solicitud: {str(e)}"
        )
        
def _distancia_km(lat1, lon1, lat2, lon2):
    """Distancia en línea recta (fórmula Haversine) entre dos puntos lat/lng."""
    from math import radians, sin, cos, sqrt, atan2
    R = 6371.0  # radio de la Tierra en km
    lat1, lon1, lat2, lon2 = map(radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# HU26 — Radios de expansión automática para la notificación inicial (se prueba
# 5km, si no hay nadie 10km, luego 20, 40 y por último 80km) y radio fijo de
# visibilidad guardado en cada solicitud para que el radar (GET /pending) no
# dependa de la ubicación de los conductores en el instante de publicar el viaje.
RADIOS_NOTIFICACION_KM = [5, 10, 20, 40, 80]
RADIO_VISIBILIDAD_KM = 60


# HU55 — Filtro FLEXIBLE de comodidades (no excluyente): en vez de decir
# "cumple / no cumple" a secas, dice CUÁNTAS de las comodidades pedidas
# cumple este conductor y cuáles le faltan, para que el pasajero decida con
# esa información (nunca se oculta un conductor solo por no tener el 100%).
_ETIQUETAS_COMODIDAD = {
    "tiene_ac": "Aire acondicionado",
    "tiene_wifi": "WiFi",
    "tiene_bano": "Baño",
    "tiene_musica": "Música",
    "tiene_maletero_amplio": "Maletero amplio",
    "tiene_sillas_bebe": "Sillas para bebé",
    "acepta_mascotas": "Acepta mascotas",
}


def _match_comodidades(db, conductor, service_request) -> dict:
    filtros = [
        (service_request.requiere_ac, "tiene_ac"),
        (service_request.requiere_wifi, "tiene_wifi"),
        (service_request.requiere_bano, "tiene_bano"),
        (service_request.requiere_musica, "tiene_musica"),
        (service_request.requiere_maletero_amplio, "tiene_maletero_amplio"),
        (service_request.requiere_sillas_bebe, "tiene_sillas_bebe"),
        (service_request.requiere_acepta_mascotas, "acepta_mascotas"),
    ]
    exigidos = [campo for exigido, campo in filtros if exigido]
    if not exigidos:
        return {"exigidas": 0, "cumplidas": 0, "cumple_todas": True, "faltantes": []}

    vehiculo = db.query(models.Vehicle).filter(models.Vehicle.owner_id == conductor.user_id).first()

    cumplidas = 0
    faltantes = []
    for campo in exigidos:
        tiene = bool(getattr(vehiculo, campo)) if vehiculo else False
        if tiene:
            cumplidas += 1
        else:
            faltantes.append(_ETIQUETAS_COMODIDAD[campo])

    return {
        "exigidas": len(exigidos),
        "cumplidas": cumplidas,
        "cumple_todas": cumplidas == len(exigidos),
        "faltantes": faltantes,
    }


# Convierte un ServiceRequest (ORM) en el dict base que espera
# schemas.ServiceRequestRead — se usa en /pending porque ahí se le agregan
# campos calculados (comodidades_*) que no son columnas de la tabla.
def _serializar_service_request(sr) -> dict:
    return {
        "request_id": sr.request_id,
        "passenger_id": sr.passenger_id,
        "origin": sr.origin,
        "destination": sr.destination,
        "departure_time": sr.departure_time,
        "return_time": sr.return_time,
        "trip_type": sr.trip_type,
        "adults_count": sr.adults_count,
        "children_count": sr.children_count,
        "has_pets": sr.has_pets,
        "status": sr.status,
        "created_at": sr.created_at,
        "origin_lat": float(sr.origin_lat) if sr.origin_lat is not None else None,
        "origin_lng": float(sr.origin_lng) if sr.origin_lng is not None else None,
        "destination_lat": float(sr.destination_lat) if sr.destination_lat is not None else None,
        "destination_lng": float(sr.destination_lng) if sr.destination_lng is not None else None,
        "requiere_ac": sr.requiere_ac,
        "requiere_wifi": sr.requiere_wifi,
        "requiere_bano": sr.requiere_bano,
        "requiere_musica": sr.requiere_musica,
        "requiere_maletero_amplio": sr.requiere_maletero_amplio,
        "requiere_sillas_bebe": sr.requiere_sillas_bebe,
        "requiere_acepta_mascotas": sr.requiere_acepta_mascotas,
    }


@router.get("/pending", response_model=list[schemas.ServiceRequestRead])
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Retorna la lista de viajes con estado 'PENDING'.
    - Conductores: ven las solicitudes pendientes dentro del radio de visibilidad
      del viaje, ordenadas de más cerca a más lejos.
"""
    try:
        # Iniciamos la consulta base buscando los PENDING
        query = db.query(models.ServiceRequest).filter(models.ServiceRequest.status == "PENDING")
        
        # Filtro inteligente por rol: Si no es conductor, filtramos por su ID
        if current_user.role != "DRIVER": 
            query = query.filter(models.ServiceRequest.passenger_id == current_user.user_id)
            
        pending_requests = query.order_by(models.ServiceRequest.created_at.desc()).all()

        if current_user.role == "DRIVER":
            # HU26 — radio de visibilidad automático + orden por cercanía. El
            # conductor ve todas las solicitudes pendientes de su zona.
            if current_user.current_lat is not None and current_user.current_lng is not None:
                con_distancia = []
                for sr in pending_requests:
                    if sr.search_lat is None or sr.search_lng is None or not sr.search_radius_km:
                        con_distancia.append((0, sr))
                        continue
                    distancia = _distancia_km(current_user.current_lat, current_user.current_lng, sr.search_lat, sr.search_lng)
                    if distancia <= float(sr.search_radius_km):
                        con_distancia.append((distancia, sr))
                con_distancia.sort(key=lambda par: par[0])
                pending_requests = [sr for _, sr in con_distancia]

            # HU55 — filtro flexible: se anota, no se oculta.
            resultado = []
            for sr in pending_requests:
                match = _match_comodidades(db, current_user, sr)
                item = _serializar_service_request(sr)
                item["comodidades_exigidas"] = match["exigidas"]
                item["comodidades_cumplidas"] = match["cumplidas"]
                item["comodidades_faltantes"] = match["faltantes"]
                resultado.append(item)
            return resultado

        return [_serializar_service_request(sr) for sr in pending_requests]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener solicitudes pendientes: {str(e)}"
        )


# HU23 — Zonas de demanda agregadas (SCRUM-164). A diferencia de /pending, esto NO
# no depende de ningún estado de conexión: el objetivo es que pueda ver
# dónde hay más flujo de solicitudes y decidir dónde posicionarse ANTES de conectarse.
# Por privacidad no se exponen ubicaciones exactas de pasajeros individuales, solo
# centroides agrupados por zona (grilla ~3km) con un conteo.
def _etiqueta_zona(origin: str) -> str:
    """Heurística simple para sacar un nombre de zona legible del texto de origen
    (formato típico de Google Places: 'Calle X, Vereda Y, El Retiro, Antioquia, Colombia')."""
    partes = [p.strip() for p in (origin or "").split(",") if p.strip()]
    partes = [p for p in partes if p.lower() not in ("colombia", "antioquia")]
    if not partes:
        return "Zona sin nombre"
    return partes[-1]


@router.get("/demand-zones")
def get_demand_zones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden ver las zonas de demanda.")

    solicitudes = db.query(
        models.ServiceRequest.origin,
        models.ServiceRequest.origin_lat,
        models.ServiceRequest.origin_lng,
    ).filter(
        models.ServiceRequest.status == "PENDING",
        models.ServiceRequest.origin_lat.isnot(None),
        models.ServiceRequest.origin_lng.isnot(None),
    ).all()

    # Grilla de ~0.03° (≈3km) para agrupar solicitudes cercanas en una sola zona
    zonas = {}
    for s in solicitudes:
        lat, lng = float(s.origin_lat), float(s.origin_lng)
        clave = (round(lat / 0.03), round(lng / 0.03))
        if clave not in zonas:
            zonas[clave] = {"lats": [], "lngs": [], "label": _etiqueta_zona(s.origin), "count": 0}
        zonas[clave]["lats"].append(lat)
        zonas[clave]["lngs"].append(lng)
        zonas[clave]["count"] += 1

    return [
        {
            "lat": sum(z["lats"]) / len(z["lats"]),
            "lng": sum(z["lngs"]) / len(z["lngs"]),
            "count": z["count"],
            "label": z["label"],
        }
        for z in zonas.values()
    ]


@router.post("/{request_id}/offers", status_code=status.HTTP_201_CREATED)
async def create_driver_offer(
    request_id: int,
    payload: schemas.OfferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Validar que el usuario que hace la petición sea realmente un conductor
    if current_user.role != 'DRIVER':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Solo los conductores registrados pueden enviar ofertas."
        )

    # 2. Verificar que el viaje exista y esté en estado PENDING
    service_request = db.query(models.ServiceRequest).filter(models.ServiceRequest.request_id == request_id).first()
    
    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="La solicitud de viaje no existe."
        )
        
    if service_request.status != 'PENDING':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"No se pueden hacer ofertas a viajes cerrados. Estado actual: {service_request.status}"
        )

    # 3. Obtener el vehicle_id del conductor automáticamente
    # Buscamos el primer vehículo registrado a nombre de este conductor
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.owner_id == current_user.user_id).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="No tienes un vehículo registrado para realizar esta oferta."
        )

    try:
        # 4. Crear y guardar la oferta en la base de datos
        new_offer = models.DriverOffer(
            request_id=request_id,
            driver_id=current_user.user_id, # Se extrae del token automáticamente
            vehicle_id=vehicle.vehicle_id,  # Se extrae de la consulta anterior
            offered_price=payload.offered_price, # Viene del JSON del frontend
            status='DRIVER_OFFERED'
        )

        db.add(new_offer)
        db.commit()
        db.refresh(new_offer)

        # Log de oferta enviada
        registrar_log(
            db,
            action="CREATE_OFFER",
            user_id=current_user.user_id,
            entity="DriverOffer",
            entity_id=new_offer.offer_id,
            detail=f"Oferta de ${new_offer.offered_price} para solicitud #{request_id}"
        )

        return {
            "message": "Oferta registrada exitosamente", 
            "offer_id": new_offer.offer_id,
            "offered_price": new_offer.offered_price
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error al guardar la oferta: {str(e)}"
        )

# SCRUM-77 — GET /api/service-requests/{request_id}/offers
# El pasajero ve todas las ofertas de su viaje con datos del conductor
# ── Historial de viajes del conductor ────────────────────────────────────────
# El conductor no tenía dónde ver lo que ya manejó: /assigned filtra por
# passenger_id y /driver/my-offers solo trae negociaciones abiertas. Este trae
# los viajes que efectivamente hizo, es decir aquellos donde su oferta quedó
# ACCEPTED, con el pasajero y el precio final.
@router.get("/driver/history")
def get_driver_trip_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo los conductores pueden ver su historial.")

    filas = (
        db.query(models.ServiceRequest, models.DriverOffer)
        .join(models.DriverOffer, models.DriverOffer.request_id == models.ServiceRequest.request_id)
        .filter(
            models.DriverOffer.driver_id == current_user.user_id,
            models.DriverOffer.status == 'ACCEPTED',
            models.ServiceRequest.status.in_(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
        )
        .order_by(models.ServiceRequest.departure_time.desc())
        .all()
    )

    resultado = []
    for viaje, oferta in filas:
        pasajero = db.query(models.User).filter(
            models.User.user_id == viaje.passenger_id
        ).first()

        # ¿Ya calificó a este pasajero? Sirve para no ofrecer calificar dos veces.
        ya_califico = db.query(models.Rating).filter(
            models.Rating.request_id == viaje.request_id,
            models.Rating.rater_id == current_user.user_id
        ).first() is not None

        resultado.append({
            "request_id": viaje.request_id,
            "origin": viaje.origin,
            "destination": viaje.destination,
            "departure_time": viaje.departure_time,
            "trip_status": viaje.status,
            "precio": float(oferta.offered_price) if oferta.offered_price is not None else 0,
            "pasajero_nombre": pasajero.full_name if pasajero else "Pasajero",
            "pasajero_foto": pasajero.profile_photo_url if pasajero else None,
            "asientos": (viaje.adults_count or 1) + (viaje.children_count or 0),
            "ya_califico": ya_califico,
        })

    return resultado


@router.get("/driver/my-offers")
def get_driver_active_offers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo los conductores pueden ver sus ofertas.")

    ofertas = db.query(models.DriverOffer).filter(
        models.DriverOffer.driver_id == current_user.user_id,
        models.DriverOffer.status.in_(['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED', 'ACCEPTED'])
    ).order_by(models.DriverOffer.created_at.desc()).all()

    resultado = []
    for oferta in ofertas:
        viaje = db.query(models.ServiceRequest).filter(
            models.ServiceRequest.request_id == oferta.request_id
        ).first()

        # HU46 — ¿el conductor ya calificó al pasajero de este viaje?
        ya_califico = False
        if viaje and viaje.status == 'COMPLETED':
            ya_califico = db.query(models.Rating).filter(
                models.Rating.request_id == oferta.request_id,
                models.Rating.rater_id == current_user.user_id
            ).first() is not None

        resultado.append({
            "offer_id": oferta.offer_id,
            "request_id": oferta.request_id,
            "origin": viaje.origin if viaje else "",
            "destination": viaje.destination if viaje else "",
            "departure_time": viaje.departure_time.isoformat() if viaje and viaje.departure_time else None,
            "offered_price": float(oferta.offered_price),
            "status": oferta.status,
            "trip_status": viaje.status if viaje else "",
            "created_at": oferta.created_at.isoformat() if oferta.created_at else None,
            "passenger_id": viaje.passenger_id if viaje else None,
            # Coordenadas, para trazar la ruta del viaje en curso en el mapa grande del conductor
            "origin_lat": float(viaje.origin_lat) if viaje and viaje.origin_lat is not None else None,
            "origin_lng": float(viaje.origin_lng) if viaje and viaje.origin_lng is not None else None,
            "destination_lat": float(viaje.destination_lat) if viaje and viaje.destination_lat is not None else None,
            "destination_lng": float(viaje.destination_lng) if viaje and viaje.destination_lng is not None else None,
            "ya_califico": ya_califico,
        })

    return resultado


# SCRUM-90/91 — GET /api/service-requests/notifications
# Obtener notificaciones del usuario actual

@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id
    ).order_by(models.Notification.created_at.desc()).limit(20).all()

    return [
        {
            "notification_id": n.notification_id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "related_offer_id": n.related_offer_id,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifs
    ]


# SCRUM-90/91 — PATCH /api/service-requests/notifications/{id}/read
# Marcar notificación como leída

@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    notif = db.query(models.Notification).filter(
        models.Notification.notification_id == notification_id,
        models.Notification.user_id == current_user.user_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")
    notif.is_read = True
    db.commit()
    return {"message": "Notificación marcada como leída."}


# GET /api/service-requests/assigned
# Pasajero ve sus viajes activos (ASSIGNED, IN_PROGRESS, COMPLETED) con datos del conductor asignado

@router.get("/assigned")
def get_assigned_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viajes = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.passenger_id == current_user.user_id,
        models.ServiceRequest.status.in_(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])
    ).order_by(models.ServiceRequest.created_at.desc()).all()

    resultado = []
    for v in viajes:
        # Buscar la oferta aceptada para obtener el conductor y precio
        oferta_aceptada = db.query(models.DriverOffer).filter(
            models.DriverOffer.request_id == v.request_id,
            models.DriverOffer.status == 'ACCEPTED'
        ).first()

        conductor_nombre = 'Conductor asignado'
        conductor_foto = None
        precio_acordado = 0
        driver_id = None
        conductor_lat = None
        conductor_lng = None

        if oferta_aceptada:
            driver_id = oferta_aceptada.driver_id
            conductor = db.query(models.User).filter(
                models.User.user_id == oferta_aceptada.driver_id
            ).first()
            if conductor:
                conductor_nombre = conductor.full_name
                conductor_foto = conductor.profile_photo_url
                # HU43 — ubicación en vivo del conductor, solo tiene sentido mientras el viaje está en curso
                if v.status == 'IN_PROGRESS':
                    conductor_lat = float(conductor.current_lat) if conductor.current_lat is not None else None
                    conductor_lng = float(conductor.current_lng) if conductor.current_lng is not None else None
            precio_acordado = float(oferta_aceptada.offered_price)

        # HU46 — ¿el pasajero ya calificó este viaje?
        ya_califico = False
        if v.status == 'COMPLETED':
            ya_califico = db.query(models.Rating).filter(
                models.Rating.request_id == v.request_id,
                models.Rating.rater_id == current_user.user_id
            ).first() is not None

        resultado.append({
            "request_id": v.request_id,
            "origin": v.origin,
            "destination": v.destination,
            "departure_time": v.departure_time.isoformat() if v.departure_time else None,
            "return_time": v.return_time.isoformat() if v.return_time else None,
            "trip_type": v.trip_type,
            "adults_count": v.adults_count,
            "children_count": v.children_count,
            "has_pets": v.has_pets,
            "status": v.status,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "conductor_nombre": conductor_nombre,
            "conductor_foto": conductor_foto,
            "precio_acordado": precio_acordado,
            "driver_id": driver_id,
            "conductor_lat": conductor_lat,
            "conductor_lng": conductor_lng,
            # Coordenadas del viaje, para trazar la ruta de seguimiento en el mapa grande
            "origin_lat": float(v.origin_lat) if v.origin_lat is not None else None,
            "origin_lng": float(v.origin_lng) if v.origin_lng is not None else None,
            "destination_lat": float(v.destination_lat) if v.destination_lat is not None else None,
            "destination_lng": float(v.destination_lng) if v.destination_lng is not None else None,
            "ya_califico": ya_califico,
        })

    return resultado


# HU42 — Recibo en PDF de un viaje completado (SCRUM-190)
@router.get("/{request_id}/receipt")
def descargar_recibo(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()
    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.passenger_id != current_user.user_id and current_user.role != 'ADMIN':
        raise HTTPException(status_code=403, detail="No tienes permiso para ver el recibo de este viaje.")

    if viaje.status != 'COMPLETED':
        raise HTTPException(status_code=400, detail="El recibo solo está disponible para viajes completados.")

    oferta_aceptada = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.status == 'ACCEPTED'
    ).first()
    conductor = None
    if oferta_aceptada:
        conductor = db.query(models.User).filter(
            models.User.user_id == oferta_aceptada.driver_id
        ).first()
    pasajero = db.query(models.User).filter(
        models.User.user_id == viaje.passenger_id
    ).first()

    # Turify no está conectado al registro oficial de FUEC (Épica futura) — este
    # número es un identificador interno de Turify, no un FUEC gubernamental real.
    numero_interno = f"TFY-{request_id:06d}"

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Encabezado verde de marca
    c.setFillColorRGB(0.086, 0.639, 0.290)
    c.rect(0, height - 2.6*cm, width, 2.6*cm, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(2*cm, height - 1.6*cm, "Turify")
    c.setFont("Helvetica", 11)
    c.drawString(2*cm, height - 2.25*cm, "Recibo de viaje")

    y = height - 4*cm
    c.setFillColorRGB(0.05, 0.05, 0.05)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(2*cm, y, f"Referencia interna N.º {numero_interno}")
    y -= 1*cm

    def campo(label, valor):
        nonlocal y
        c.setFont("Helvetica-Bold", 10)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.drawString(2*cm, y, label)
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.05, 0.05, 0.05)
        c.drawString(6*cm, y, str(valor))
        y -= 0.75*cm

    campo("Pasajero:", pasajero.full_name if pasajero else "-")
    campo("Conductor:", conductor.full_name if conductor else "No disponible")
    campo("Origen:", viaje.origin)
    campo("Destino:", viaje.destination)
    campo("Fecha de salida:", viaje.departure_time.strftime('%d/%m/%Y %H:%M') if viaje.departure_time else "-")
    campo("Tipo de viaje:", "Ida y vuelta" if viaje.trip_type == 'ROUND_TRIP' else "Solo ida")
    campo("Pasajeros:", (viaje.adults_count or 0) + (viaje.children_count or 0))
    precio = float(oferta_aceptada.offered_price) if oferta_aceptada else 0
    campo("Precio pagado:", f"${precio:,.0f} COP")

    y -= 0.6*cm
    c.setStrokeColorRGB(0.85, 0.85, 0.85)
    c.line(2*cm, y, width - 2*cm, y)
    y -= 0.7*cm

    c.setFont("Helvetica-Oblique", 8)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(2*cm, y, "Este recibo es un comprobante interno de Turify, no un FUEC oficial ante autoridad de transporte.")
    y -= 0.4*cm
    c.drawString(2*cm, y, f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    c.showPage()
    c.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="turify_recibo_{request_id}.pdf"'}
    )


# HU17 — PATCH /api/service-requests/{request_id}/start
# Conductor inicia el viaje: ASSIGNED → IN_PROGRESS

@router.get("/{request_id}/offers")
def get_offers_for_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    # Verificar que el viaje exista
    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not service_request:
        raise HTTPException(status_code=404, detail="Solicitud de viaje no encontrada.")

    # Solo el pasajero dueño del viaje puede ver sus ofertas
    if service_request.passenger_id != current_user.user_id and current_user.role != 'ADMIN':
        raise HTTPException(status_code=403, detail="No tienes permiso para ver estas ofertas.")

    ofertas = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.status.in_(['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED'])
    ).all()

    pasajeros_totales = (service_request.adults_count or 0) + (service_request.children_count or 0)

    resultado = []
    for oferta in ofertas:
        conductor = db.query(models.User).filter(
            models.User.user_id == oferta.driver_id
        ).first()
        # HU46 — calificación real del conductor (antes venía simulada en el frontend)
        promedio, cantidad = _promedio_calificacion(db, oferta.driver_id)

        # HU55 — comodidades, capacidad y categoría del vehículo (badges para el radar)
        vehiculo = db.query(models.Vehicle).filter(
            models.Vehicle.vehicle_id == oferta.vehicle_id
        ).first()
        comodidades = None
        recomendado = False
        if vehiculo:
            capacidad = vehiculo.capacidad_real or vehiculo.capacity
            # HU55 — filtro flexible: se muestra la oferta igual aunque no cumpla
            # el 100% de las comodidades pedidas; el pasajero ve cuántas cumple y
            # cuáles le faltan, y decide él mismo con esa información.
            match = _match_comodidades(db, conductor, service_request) if conductor else {"exigidas": 0, "cumplidas": 0, "cumple_todas": True, "faltantes": []}
            comodidades = {
                "categoria": _categoria_vehiculo(capacidad),
                "capacidad": capacidad,
                "tiene_ac": vehiculo.tiene_ac,
                "tiene_wifi": vehiculo.tiene_wifi,
                "tiene_bano": vehiculo.tiene_bano,
                "tiene_musica": vehiculo.tiene_musica,
                "tiene_maletero_amplio": vehiculo.tiene_maletero_amplio,
                "tiene_sillas_bebe": vehiculo.tiene_sillas_bebe,
                "acepta_mascotas": vehiculo.acepta_mascotas,
                "cargo_mascota": float(vehiculo.cargo_mascota) if vehiculo.cargo_mascota is not None else None,
                "acepta_menores_2_anos": vehiculo.acepta_menores_2_anos,
                "comodidades_exigidas": match["exigidas"],
                "comodidades_cumplidas": match["cumplidas"],
                "comodidades_faltantes": match["faltantes"],
            }
            # Recomendado: capacidad suficiente para el grupo (sin sobredimensionar
            # de forma exagerada) Y que cumpla todas las comodidades que el
            # pasajero exigió. Si le falta alguna, la oferta se sigue mostrando
            # igual — solo no se destaca como "recomendada".
            if pasajeros_totales > 0 and capacidad >= pasajeros_totales:
                recomendado = capacidad <= max(pasajeros_totales * 3, pasajeros_totales + 3)
            if service_request.has_pets and not vehiculo.acepta_mascotas:
                recomendado = False
            if match["exigidas"] > 0 and not match["cumple_todas"]:
                recomendado = False

        resultado.append({
            "offer_id": oferta.offer_id,
            "request_id": oferta.request_id,
            "driver_id": oferta.driver_id,
            "driver_name": conductor.full_name if conductor else "Conductor",
            "driver_photo": conductor.profile_photo_url if conductor else None,
            # HU38 — badge de conductor verificado (RUNT aprobado), visible en la oferta
            "driver_verificado": bool(conductor.conductor_verificado) if conductor else False,
            "vehicle_id": oferta.vehicle_id,
            "offered_price": float(oferta.offered_price),
            "status": oferta.status,
            "created_at": oferta.created_at.isoformat() if oferta.created_at else None,
            "driver_rating": promedio,
            "driver_rating_count": cantidad,
            "comodidades": comodidades,
            "recomendado": recomendado,
        })

    return resultado


# SCRUM-78 — PATCH /api/offers/{offer_id}/counter-offer
# El pasajero envía una contraoferta — cambia el estado a PASSENGER_COUNTER_OFFERED
@router.patch("/offers/{offer_id}/counter-offer")
def counter_offer(
    offer_id: int,
    payload: schemas.CounterOfferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    oferta = db.query(models.DriverOffer).filter(
        models.DriverOffer.offer_id == offer_id
    ).first()

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada.")

    # Verificar que el pasajero sea el dueño del viaje
    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == oferta.request_id
    ).first()

    if not service_request or service_request.passenger_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para contraofertar en este viaje.")

    if oferta.status not in ['DRIVER_OFFERED']:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede contraofertar una oferta en estado: {oferta.status}"
        )

    oferta.offered_price = payload.offered_price
    oferta.status = 'PASSENGER_COUNTER_OFFERED'
    db.commit()
    db.refresh(oferta)

    registrar_log(
        db,
        action="COUNTER_OFFER",
        user_id=current_user.user_id,
        entity="DriverOffer",
        entity_id=oferta.offer_id,
        detail=f"Contraoferta de ${payload.offered_price} para oferta #{offer_id}"
    )

    # Notificar al conductor que recibió una contraoferta
    pasajero = db.query(models.User).filter(
        models.User.user_id == current_user.user_id
    ).first()
    nombre_pasajero = pasajero.full_name if pasajero else "El pasajero"

    crear_notificacion(
        db,
        user_id=oferta.driver_id,
        title="Nueva contraoferta recibida",
        message=f"{nombre_pasajero} propuso ${payload.offered_price:,.0f} para el viaje de {service_request.origin} → {service_request.destination}.",
        tipo="COUNTER_OFFER",
        offer_id=oferta.offer_id
    )

    return {
        "message": "Contraoferta enviada al conductor.",
        "offer_id": oferta.offer_id,
        "nuevo_precio": float(oferta.offered_price),
        "nuevo_estado": oferta.status
    }


# SCRUM-81 — PATCH /api/offers/{offer_id}/accept
# El pasajero acepta una oferta — pasa a ACCEPTED y el viaje a ASSIGNED
@router.patch("/offers/{offer_id}/accept")
def accept_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    oferta = db.query(models.DriverOffer).filter(
        models.DriverOffer.offer_id == offer_id
    ).first()

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada.")

    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == oferta.request_id
    ).first()

    if not service_request or service_request.passenger_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para aceptar esta oferta.")

    if oferta.status not in ['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED']:
        raise HTTPException(status_code=400, detail=f"No se puede aceptar una oferta en estado: {oferta.status}")

    # Aceptar esta oferta
    oferta.status = 'ACCEPTED'

    # Rechazar todas las demás ofertas del mismo viaje
    otras_ofertas = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == oferta.request_id,
        models.DriverOffer.offer_id != offer_id
    ).all()
    for otra in otras_ofertas:
        otra.status = 'REJECTED'

    # Marcar el viaje como ASSIGNED
    service_request.status = 'ASSIGNED'

    db.commit()

    registrar_log(
        db,
        action="ACCEPT_OFFER",
        user_id=current_user.user_id,
        entity="DriverOffer",
        entity_id=oferta.offer_id,
        detail=f"Oferta #{offer_id} aceptada. Viaje #{oferta.request_id} asignado al conductor #{oferta.driver_id}"
    )

    # Notificar al conductor que su oferta fue aceptada
    pasajero = db.query(models.User).filter(
        models.User.user_id == current_user.user_id
    ).first()
    nombre_pasajero = pasajero.full_name if pasajero else "El pasajero"

    crear_notificacion(
        db,
        user_id=oferta.driver_id,
        title="¡Tu oferta fue aceptada!",
        message=f"{nombre_pasajero} aceptó tu oferta de ${float(oferta.offered_price):,.0f}. Viaje de {service_request.origin} → {service_request.destination}.",
        tipo="TRIP_ACCEPTED",
        offer_id=oferta.offer_id
    )

    # Notificar a los conductores cuyas ofertas fueron rechazadas
    for otra in otras_ofertas:
        crear_notificacion(
            db,
            user_id=otra.driver_id,
            title="Oferta no seleccionada",
            message=f"El pasajero eligió otra oferta para el viaje de {service_request.origin} → {service_request.destination}.",
            tipo="TRIP_REJECTED",
            offer_id=otra.offer_id
        )

    return {
        "message": "¡Oferta aceptada! El viaje ha sido asignado al conductor.",
        "offer_id": oferta.offer_id,
        "request_id": oferta.request_id,
        "estado_oferta": "ACCEPTED",
        "estado_viaje": "ASSIGNED"
    }

# --- Función auxiliar para crear notificaciones ---
def crear_notificacion(db, user_id: int, title: str, message: str, tipo: str, offer_id: int = None):
    try:
        notif = models.Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=tipo,
            related_offer_id=offer_id
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Notificación] Error: {e}")


# HU55 — Categoría de vehículo (misma tabla de rangos que app/routers/drivers.py)
_RANGOS_CATEGORIA_VEHICULO = [
    (1, 4,   "SEDAN"),
    (5, 10,  "VAN"),
    (11, 19, "MICROBUS"),
    (20, 35, "BUS"),
    (36, 60, "BUS_GRANDE"),
]


def _categoria_vehiculo(capacidad: int) -> str:
    for minimo, maximo, categoria in _RANGOS_CATEGORIA_VEHICULO:
        if minimo <= capacidad <= maximo:
            return categoria
    return "BUS_GRANDE" if capacidad > 60 else "SEDAN"


# HU46 — Calificaciones bidireccionales (SCRUM-194)
def _promedio_calificacion(db, user_id: int):
    """Promedio y cantidad de calificaciones (Rating.score) recibidas por un usuario."""
    fila = db.query(
        func.avg(models.Rating.score),
        func.count(models.Rating.rating_id)
    ).filter(models.Rating.rated_id == user_id).first()
    promedio, cantidad = fila
    return (round(float(promedio), 1) if promedio is not None else None), (cantidad or 0)


# SCRUM-82 — PATCH /api/service-requests/offers/{offer_id}/resolve
# El conductor responde a una contraoferta: acepta o rechaza
@router.patch("/offers/{offer_id}/resolve")
def resolve_counter_offer(
    offer_id: int,
    payload: schemas.ResolveOfferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo los conductores pueden responder contraoferta.")

    oferta = db.query(models.DriverOffer).filter(
        models.DriverOffer.offer_id == offer_id,
        models.DriverOffer.driver_id == current_user.user_id
    ).first()

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada o no te pertenece.")

    if oferta.status != 'PASSENGER_COUNTER_OFFERED':
        raise HTTPException(
            status_code=400,
            detail=f"Solo puedes resolver ofertas en estado PASSENGER_COUNTER_OFFERED. Estado actual: {oferta.status}"
        )

    service_request = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == oferta.request_id
    ).first()

    if payload.action == 'ACCEPT':
        # Aceptar la contraoferta — el viaje queda asignado
        oferta.status = 'ACCEPTED'
        service_request.status = 'ASSIGNED'

        # Rechazar las demás ofertas del mismo viaje
        otras = db.query(models.DriverOffer).filter(
            models.DriverOffer.request_id == oferta.request_id,
            models.DriverOffer.offer_id != offer_id
        ).all()
        for otra in otras:
            otra.status = 'REJECTED'

        db.commit()

        # Notificar al pasajero que el conductor aceptó
        crear_notificacion(
            db,
            user_id=service_request.passenger_id,
            title="¡Viaje confirmado!",
            message=f"El conductor aceptó tu contraoferta de ${oferta.offered_price}. Tu viaje está confirmado.",
            tipo="TRIP_ACCEPTED",
            offer_id=oferta.offer_id
        )

        registrar_log(db, action="ACCEPT_COUNTER_OFFER", user_id=current_user.user_id,
            entity="DriverOffer", entity_id=oferta.offer_id,
            detail=f"Conductor #{current_user.user_id} aceptó contraoferta de ${oferta.offered_price}")

        return {
            "message": "Contraoferta aceptada. El viaje ha sido confirmado.",
            "offer_id": oferta.offer_id,
            "estado_oferta": "ACCEPTED",
            "estado_viaje": "ASSIGNED"
        }

    elif payload.action == 'REJECT':
        # Rechazar la contraoferta — su oferta se cancela
        oferta.status = 'REJECTED'
        db.commit()

        # Notificar al pasajero que el conductor rechazó
        crear_notificacion(
            db,
            user_id=service_request.passenger_id,
            title="Conductor rechazó la contraoferta",
            message="Un conductor rechazó tu contraoferta. Puedes aceptar otra oferta disponible.",
            tipo="TRIP_REJECTED",
            offer_id=oferta.offer_id
        )

        registrar_log(db, action="REJECT_COUNTER_OFFER", user_id=current_user.user_id,
            entity="DriverOffer", entity_id=oferta.offer_id,
            detail=f"Conductor #{current_user.user_id} rechazó contraoferta")

        return {
            "message": "Has rechazado la contraoferta. Tu oferta fue cancelada.",
            "offer_id": oferta.offer_id,
            "estado_oferta": "REJECTED"
        }

    else:
        raise HTTPException(status_code=400, detail="Acción inválida. Use 'ACCEPT' o 'REJECT'.")


# SCRUM-83 — GET /api/service-requests/driver/my-offers
# El conductor ve sus negociaciones activas (SCRUM-83)


# HU26 — PATCH /api/service-requests/{request_id}/cancel
# El pasajero cancela la búsqueda mientras el viaje sigue PENDING (todavía no
# aceptó ninguna oferta). Una vez el viaje pasa a ASSIGNED ya no se puede
# cancelar desde aquí — a esa altura hay un conductor comprometido y eso
# necesitaría su propio flujo (no forma parte de este cambio).
@router.patch("/{request_id}/cancel")
def cancel_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.passenger_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para cancelar este viaje.")

    if viaje.status != 'PENDING':
        raise HTTPException(
            status_code=400,
            detail=f"Solo puedes cancelar la búsqueda mientras el viaje está pendiente. Estado actual: {viaje.status}"
        )

    viaje.status = 'CANCELLED'

    # Cualquier oferta que ya hubieran enviado conductores para este viaje
    # queda sin efecto — se avisa a cada conductor para que no siga esperando
    # respuesta de una solicitud que ya no existe.
    ofertas_activas = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.status.in_(['DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED'])
    ).all()
    for oferta in ofertas_activas:
        oferta.status = 'REJECTED'

    db.commit()

    for oferta in ofertas_activas:
        crear_notificacion(
            db,
            user_id=oferta.driver_id,
            title="Viaje cancelado por el pasajero",
            message=f"El pasajero canceló la solicitud de {viaje.origin} → {viaje.destination}.",
            tipo="TRIP_REJECTED",
            offer_id=oferta.offer_id
        )

    registrar_log(db, action="CANCEL_TRIP", user_id=current_user.user_id,
        entity="ServiceRequest", entity_id=viaje.request_id,
        detail=f"Pasajero #{current_user.user_id} canceló la búsqueda del viaje #{request_id}")

    return {
        "message": "Búsqueda cancelada.",
        "request_id": viaje.request_id,
        "status": "CANCELLED"
    }


@router.patch("/{request_id}/start")
def start_trip(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo el conductor puede iniciar el viaje.")

    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.status != 'ASSIGNED':
        raise HTTPException(status_code=400, detail=f"El viaje debe estar en estado ASSIGNED para iniciarlo. Estado actual: {viaje.status}")

    # Verificar que el conductor sea el asignado
    oferta_aceptada = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.driver_id == current_user.user_id,
        models.DriverOffer.status == 'ACCEPTED'
    ).first()

    if not oferta_aceptada:
        raise HTTPException(status_code=403, detail="No eres el conductor asignado a este viaje.")

    viaje.status = 'IN_PROGRESS'
    db.commit()

    # Notificar al pasajero
    crear_notificacion(
        db,
        user_id=viaje.passenger_id,
        title="¡Tu viaje ha comenzado!",
        message=f"El conductor está en camino. Viaje de {viaje.origin} a {viaje.destination}.",
        tipo="TRIP_STARTED",
        offer_id=oferta_aceptada.offer_id
    )

    registrar_log(db, action="TRIP_STARTED", user_id=current_user.user_id,
        entity="ServiceRequest", entity_id=viaje.request_id,
        detail=f"Viaje #{request_id} iniciado por conductor #{current_user.user_id}")

    return {
        "message": "¡Viaje iniciado! El pasajero ha sido notificado.",
        "request_id": viaje.request_id,
        "status": "IN_PROGRESS"
    }


# HU17 — PATCH /api/service-requests/{request_id}/complete
# Conductor finaliza el viaje: IN_PROGRESS → COMPLETED
@router.patch("/{request_id}/complete")
def complete_trip(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="Solo el conductor puede finalizar el viaje.")

    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.status != 'IN_PROGRESS':
        raise HTTPException(status_code=400, detail=f"El viaje debe estar EN CURSO para finalizarlo. Estado actual: {viaje.status}")

    # Verificar que el conductor sea el asignado
    oferta_aceptada = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.driver_id == current_user.user_id,
        models.DriverOffer.status == 'ACCEPTED'
    ).first()

    if not oferta_aceptada:
        raise HTTPException(status_code=403, detail="No eres el conductor asignado a este viaje.")

    viaje.status = 'COMPLETED'
    db.commit()

    # Notificar al pasajero
    crear_notificacion(
        db,
        user_id=viaje.passenger_id,
        title="¡Viaje completado!",
        message=f"Tu viaje de {viaje.origin} a {viaje.destination} ha finalizado. ¡Gracias por usar Turify!",
        tipo="TRIP_COMPLETED",
        offer_id=oferta_aceptada.offer_id
    )

    registrar_log(db, action="TRIP_COMPLETED", user_id=current_user.user_id,
        entity="ServiceRequest", entity_id=viaje.request_id,
        detail=f"Viaje #{request_id} completado por conductor #{current_user.user_id}")

    return {
        "message": "¡Viaje completado! Gracias por usar Turify.",
        "request_id": viaje.request_id,
        "status": "COMPLETED"
    }


# HU17 — GET /api/service-requests/{request_id}/status
# Pasajero consulta el estado actual de su viaje
@router.get("/{request_id}/status")
def get_trip_status(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.passenger_id != current_user.user_id and current_user.role != 'DRIVER':
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este viaje.")

    return {
        "request_id": viaje.request_id,
        "status": viaje.status,
        "origin": viaje.origin,
        "destination": viaje.destination,
        "departure_time": viaje.departure_time.isoformat() if viaje.departure_time else None
    }

# HU10 — POST /api/service-requests/{request_id}/passengers
# Pasajero registra los ocupantes del viaje (FUEC simulado)
@router.post("/{request_id}/passengers", status_code=201)
def registrar_ocupantes(
    request_id: int,
    payload: schemas.TripPassengersCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    if viaje.passenger_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Solo el pasajero del viaje puede registrar ocupantes.")

    if viaje.status not in ['ASSIGNED', 'IN_PROGRESS']:
        raise HTTPException(status_code=400, detail=f"Solo puedes registrar ocupantes en viajes confirmados. Estado actual: {viaje.status}")

    # Eliminar registros previos si el pasajero actualiza la lista
    db.query(models.TripPassenger).filter(
        models.TripPassenger.request_id == request_id
    ).delete()

    for p in payload.passengers:
        db.add(models.TripPassenger(
            request_id=request_id,
            full_name=p.full_name,
            document_type=p.document_type,
            document_number=p.document_number
        ))

    db.commit()

    registrar_log(db, action="REGISTER_FUEC", user_id=current_user.user_id,
        entity="ServiceRequest", entity_id=request_id,
        detail=f"FUEC registrado con {len(payload.passengers)} ocupante(s) para viaje #{request_id}")

    return {
        "message": f"{len(payload.passengers)} ocupante(s) registrado(s) correctamente.",
        "request_id": request_id
    }


# HU10 — GET /api/service-requests/{request_id}/passengers
# Conductor y pasajero consultan los ocupantes registrados
@router.get("/{request_id}/passengers")
def get_ocupantes(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()

    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")

    # El pasajero o el conductor asignado pueden ver los ocupantes
    es_pasajero = viaje.passenger_id == current_user.user_id
    es_conductor_asignado = False

    if current_user.role == 'DRIVER':
        oferta = db.query(models.DriverOffer).filter(
            models.DriverOffer.request_id == request_id,
            models.DriverOffer.driver_id == current_user.user_id,
            models.DriverOffer.status == 'ACCEPTED'
        ).first()
        es_conductor_asignado = oferta is not None

    if not es_pasajero and not es_conductor_asignado and current_user.role != 'ADMIN':
        raise HTTPException(status_code=403, detail="No tienes permiso para ver estos datos.")

    ocupantes = db.query(models.TripPassenger).filter(
        models.TripPassenger.request_id == request_id
    ).all()

    return [
        {
            "passenger_entry_id": o.passenger_entry_id,
            "full_name": o.full_name,
            "document_type": o.document_type,
            "document_number": o.document_number
        }
        for o in ocupantes
    ]


# ── HU46 — Calificaciones bidireccionales (SCRUM-194) ────────────────────────
@router.post("/{request_id}/rating", status_code=status.HTTP_201_CREATED)
def calificar_viaje(
    request_id: int,
    payload: schemas.RatingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Pasajero y conductor se califican mutuamente (1-5 estrellas + comentario
    opcional) una vez el viaje está COMPLETED. Cada uno solo puede calificar
    una vez por viaje — un segundo envío actualiza su calificación anterior.
    """
    viaje = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.request_id == request_id
    ).first()
    if not viaje:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    if viaje.status != 'COMPLETED':
        raise HTTPException(status_code=400, detail="Solo puedes calificar viajes ya completados.")

    oferta_aceptada = db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.status == 'ACCEPTED'
    ).first()
    if not oferta_aceptada:
        raise HTTPException(status_code=400, detail="Este viaje no tiene un conductor asignado.")

    # Determinar quién califica a quién según el rol de quien hace la petición
    if current_user.user_id == viaje.passenger_id:
        rated_id = oferta_aceptada.driver_id
    elif current_user.user_id == oferta_aceptada.driver_id:
        rated_id = viaje.passenger_id
    else:
        raise HTTPException(status_code=403, detail="No participaste en este viaje.")

    existente = db.query(models.Rating).filter(
        models.Rating.request_id == request_id,
        models.Rating.rater_id == current_user.user_id
    ).first()

    if existente:
        existente.score = payload.score
        existente.comment = payload.comment
    else:
        db.add(models.Rating(
            request_id=request_id,
            rater_id=current_user.user_id,
            rated_id=rated_id,
            score=payload.score,
            comment=payload.comment,
        ))

    db.commit()

    registrar_log(db, action="CREATE_RATING", user_id=current_user.user_id,
        entity="Rating", entity_id=request_id,
        detail=f"Calificación de {payload.score}★ para usuario #{rated_id} (viaje #{request_id})")

    return {"message": "¡Gracias por tu calificación!", "score": payload.score}


@router.get("/{request_id}/rating")
def obtener_mi_calificacion(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """Indica si el usuario autenticado ya calificó este viaje (y con qué puntaje)."""
    mia = db.query(models.Rating).filter(
        models.Rating.request_id == request_id,
        models.Rating.rater_id == current_user.user_id
    ).first()
    return {
        "ya_califico": mia is not None,
        "score": mia.score if mia else None,
        "comment": mia.comment if mia else None,
    }