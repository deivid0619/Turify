from sqlalchemy import (
    Column, Integer, String, Enum, ForeignKey, DateTime,
    Boolean, Numeric, Text, Index, JSON, CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AffiliatedCompany(Base):
    __tablename__ = "AffiliatedCompany"

    company_id  = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name        = Column(String(100), nullable=False)
    nit         = Column(String(50), unique=True, nullable=False)
    logo_url    = Column(Text)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    users    = relationship("User", back_populates="company")
    vehicles = relationship("Vehicle", back_populates="company")


class User(Base):
    __tablename__ = "User"
    __table_args__ = (
        CheckConstraint("email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]{2,}$'", name="ck_user_email"),
        CheckConstraint("phone_number ~ '^\\+?[0-9]{7,15}$'", name="ck_user_phone"),
        CheckConstraint("age IS NULL OR (age >= 0 AND age <= 120)", name="ck_user_age"),
        CheckConstraint("char_length(full_name) >= 3", name="ck_user_name_len"),
    )

    user_id             = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name           = Column(String(100), nullable=False)
    email               = Column(String(100), unique=True, nullable=False)
    phone_number        = Column(String(20), nullable=False)
    password_hash       = Column(String(255), nullable=False)
    role                = Column(Enum('PASSENGER', 'DRIVER', 'ADMIN', name='user_role'), default='PASSENGER')
    status              = Column(Enum('ACTIVE', 'INACTIVE', name='user_status'), default='ACTIVE')
    affiliated_company  = Column(Integer, ForeignKey("AffiliatedCompany.company_id", ondelete="SET NULL"), nullable=True)
    profile_photo_url   = Column(Text)
    age                 = Column(Integer)
    # Campos nuevos — rango geográfico de conductores (Épica 3)
    current_lat         = Column(Numeric(10, 8))
    current_lng         = Column(Numeric(11, 8))
    is_online           = Column(Boolean, default=False)
    # Campos nuevos — calificaciones (Épica 7)
    rating_avg          = Column(Numeric(3, 2), default=0.00)
    total_ratings       = Column(Integer, default=0)
    # HU38 — Badge de "conductor verificado": se activa cuando el admin aprueba el
    # RUNT del conductor (experiencia declarada verificada). Es independiente del
    # rol DRIVER/documentos obligatorios de registro — el RUNT es opcional y posterior.
    conductor_verificado = Column(Boolean, default=False)
    # HU59 — cuántas veces este conductor canceló un viaje ya ASSIGNED sin
    # justificar fuerza mayor. Es la "penalización en su calificación" del
    # criterio de aceptación: un contador aparte de rating_avg, porque Rating
    # exige un viaje COMPLETED y una cancelación nunca llega a serlo.
    cancelaciones_injustificadas = Column(Integer, nullable=False, default=0)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())

    company     = relationship("AffiliatedCompany", back_populates="users")
    documents   = relationship("Document", back_populates="owner", cascade="all, delete")
    vehicles    = relationship("Vehicle", back_populates="owner", cascade="all, delete")


class Document(Base):
    __tablename__ = "Document"

    document_id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id             = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    document_type       = Column(Enum(
        'SOAT', 'Licencia de Conduccion', 'Tarjeta de operacion',
        'Tecnomecanica', 'Seguros Contractual y extracontractual', 'RUNT',
        'Cedula frente', 'Cedula reverso',  # SCRUM-252
        name='doc_type'
    ), nullable=False)
    file_url            = Column(Text, nullable=False)
    verification_status = Column(Enum(
        'PENDING', 'APPROVED', 'REJECTED', 'AI_PRE_APPROVED', 'AI_PRE_REJECTED',
        name='verification_status'
    ), default='PENDING')
    # Campos nuevos — Agente IA verificación (Épica 4 HU61)
    ai_extracted_data   = Column(JSONB)
    ai_expiry_date      = Column(DateTime)
    ai_holder_name      = Column(String(100))
    ai_confidence       = Column(Numeric(5, 2))
    ai_observations     = Column(Text)
    # Para RUNT
    years_experience    = Column(Integer)
    license_categories  = Column(String(50))
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="documents")


class Vehicle(Base):
    __tablename__ = "Vehicle"

    vehicle_id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id                = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    company_id              = Column(Integer, ForeignKey("AffiliatedCompany.company_id", ondelete="SET NULL"), nullable=True)
    plate                   = Column(String(20), unique=True, nullable=False)
    capacity                = Column(Integer, nullable=False)
    capacidad_real          = Column(Integer)
    vehicle_year            = Column(Integer)
    photo_url               = Column(Text)
    # SCRUM-253 — fotos reales que ve el pasajero: [{"tipo", "url", "subida"}],
    # una por tipo (ver TIPOS_FOTO_VEHICULO en routers/drivers.py).
    fotos                   = Column(JSONB, nullable=False, default=list)
    # Tarifas personalizadas (Épica 4)
    tarifa_km_base          = Column(Numeric(10, 2))
    tarifa_espera_hora      = Column(Numeric(10, 2))
    tarifa_dia              = Column(Numeric(10, 2))
    km_incluidos_por_dia    = Column(Integer, default=200)
    recargo_dificil_acceso  = Column(Numeric(5, 2), default=15.00)
    # Comodidades (Épica 4 HU55)
    tiene_ac                = Column(Boolean, default=False)
    tiene_wifi              = Column(Boolean, default=False)
    tiene_bano              = Column(Boolean, default=False)
    tiene_musica            = Column(Boolean, default=False)
    tiene_maletero_amplio   = Column(Boolean, default=False)
    tiene_sillas_bebe       = Column(Boolean, default=False)
    tiene_sillas_reclinables = Column(Boolean, default=False)
    tiene_cargador_usb     = Column(Boolean, default=False)
    tiene_tv                = Column(Boolean, default=False)
    tiene_buen_audio        = Column(Boolean, default=False)
    acepta_mascotas         = Column(Boolean, default=False)
    cargo_mascota           = Column(Numeric(10, 2), default=0)
    acepta_menores_2_anos   = Column(Boolean, default=True)
    created_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())

    owner   = relationship("User", back_populates="vehicles")
    company = relationship("AffiliatedCompany", back_populates="vehicles")


class ServiceRequest(Base):
    __tablename__ = "ServiceRequest"
    __table_args__ = (
        CheckConstraint("adults_count >= 1", name="ck_sr_adults"),
        CheckConstraint("children_count >= 0", name="ck_sr_children"),
        CheckConstraint("infants_count >= 0", name="ck_sr_infants"),
        CheckConstraint("return_time IS NULL OR return_time > departure_time", name="ck_sr_return_after"),
        CheckConstraint("tramo IS NULL OR tramo IN ('IDA', 'EN_DESTINO', 'REGRESO')", name="ck_sr_tramo"),
    )

    request_id          = Column(Integer, primary_key=True, autoincrement=True)
    passenger_id        = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    origin              = Column(String(255), nullable=False)
    destination         = Column(String(255), nullable=False)
    origin_lat          = Column(Numeric(10, 8))
    origin_lng          = Column(Numeric(11, 8))
    destination_lat     = Column(Numeric(10, 8))
    destination_lng     = Column(Numeric(11, 8))
    trip_type           = Column(Enum('ONE_WAY', 'ROUND_TRIP', name='trip_type'), nullable=False, default='ONE_WAY')
    departure_time      = Column(TIMESTAMP(timezone=True), nullable=False)
    return_time         = Column(TIMESTAMP(timezone=True))
    adults_count        = Column(Integer, nullable=False)
    children_count      = Column(Integer, default=0)
    infants_count       = Column(Integer, default=0)
    has_pets            = Column(Boolean, default=False)
    num_pets            = Column(Integer, default=0)
    status              = Column(Enum(
        'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SCHEDULED',
        name='request_status'
    ), default='PENDING')
    # Campos del motor de precio sugerido (ÉPICA 12, HU29 — antes Épica 4)
    distance_km         = Column(Numeric(10, 2))
    tolls_count         = Column(Integer, default=0)
    tolls_cost          = Column(Numeric(10, 2), default=0)
    wait_time_hours     = Column(Numeric(5, 2), default=0)
    num_days            = Column(Integer, default=1)
    tipo_via            = Column(Enum('PAVIMENTADA', 'DESTAPADA', 'MIXTA', name='via_type'), default='PAVIMENTADA')
    is_peak_hour        = Column(Boolean, default=False)
    is_high_season      = Column(Boolean, default=False)
    suggested_price     = Column(Numeric(10, 2))
    suggested_price_min = Column(Numeric(10, 2))
    suggested_price_max = Column(Numeric(10, 2))
    price_explanation   = Column(Text)
    intermediate_stops  = Column(JSONB)
    # El FUEC (Formato Único de Extracto de Contrato) lo expide la empresa
    # afiliada del conductor -- Turify no lo genera, solo lo recibe. El
    # conductor lo carga acá antes de poder iniciar el viaje (junto con los
    # ocupantes registrados en TripPassenger, ver start_trip).
    fuec_url            = Column(Text)
    # HU26 — Punto y radio de búsqueda de conductores. Ya NO lo elige el pasajero:
    # se calculan automáticamente al crear el viaje (search_lat/lng = origen del
    # viaje; search_radius_km = radio amplio fijo usado para que cualquier
    # conductor que se conecte más tarde siga viendo la solicitud en su radar).
    search_lat           = Column(Numeric(10, 8))
    search_lng           = Column(Numeric(11, 8))
    search_radius_km     = Column(Numeric(5, 2), default=15)
    # HU55 — Comodidades del vehículo que el pasajero exige (filtro de búsqueda).
    # Si todas quedan en False, no se filtra por comodidades.
    requiere_ac              = Column(Boolean, default=False)
    requiere_wifi            = Column(Boolean, default=False)
    requiere_bano            = Column(Boolean, default=False)
    requiere_musica          = Column(Boolean, default=False)
    requiere_maletero_amplio = Column(Boolean, default=False)
    requiere_sillas_bebe     = Column(Boolean, default=False)
    requiere_sillas_reclinables = Column(Boolean, default=False)
    requiere_cargador_usb    = Column(Boolean, default=False)
    requiere_tv              = Column(Boolean, default=False)
    requiere_buen_audio      = Column(Boolean, default=False)
    requiere_acepta_mascotas = Column(Boolean, default=False)
    # HU55.1 — tipo de servicio elegido por el pasajero. "ECONOMICO" no filtra
    # por comodidades (cualquier buseta puede ofertar); "ESTANDAR" exige que el
    # conductor cumpla TODAS las comodidades marcadas arriba para poder ver la
    # solicitud en su radar y ofertar.
    tipo_servicio            = Column(String(20), default="ECONOMICO")
    # ÉPICA 12 — el pasajero publicó aceptando el precio sugerido tal cual
    # (True) en vez de eligiendo negociar manualmente (False). Si es True, el
    # conductor no puede ofertar otro precio: solo aceptar o dejarlo pasar.
    precio_fijo         = Column(Boolean, default=False)
    # HU59 — registro de cómo se canceló el viaje (SCRUM-211). penalty_amount
    # es lo que corresponde según la anticipación, calculado sobre el precio
    # ya aceptado -- Turify todavía no cobra nada automáticamente (no hay
    # pasarela de pago integrada), es el registro contractual de lo debido.
    cancelled_by         = Column(Enum('PASSENGER', 'DRIVER', name='cancelled_by_type'))
    cancellation_reason  = Column(Text)
    is_force_majeure     = Column(Boolean, default=False)
    force_majeure_evidence_url = Column(Text)
    penalty_percentage   = Column(Numeric(5, 2))
    penalty_amount       = Column(Numeric(10, 2))
    cancelled_at          = Column(TIMESTAMP(timezone=True))
    # SCRUM-259 — viaje por etapas. `tramo` dice en qué parte va un viaje
    # IN_PROGRESS: IDA (ya recogió al grupo), EN_DESTINO (ida y vuelta: llegó
    # y espera para volver) o REGRESO (los recogió para volver). El código de
    # abordaje lo ve solo el pasajero y se lo dicta al conductor al subir: sin
    # él no se puede iniciar ni la ida ni el regreso. Se borra al usarlo.
    tramo                  = Column(String(12))
    codigo_abordaje        = Column(String(4))
    codigo_intentos        = Column(Integer, nullable=False, default=0)
    codigo_bloqueado_hasta = Column(TIMESTAMP(timezone=True))
    abordo_at              = Column(TIMESTAMP(timezone=True))
    llego_destino_at       = Column(TIMESTAMP(timezone=True))
    abordo_regreso_at      = Column(TIMESTAMP(timezone=True))
    finalizado_at          = Column(TIMESTAMP(timezone=True))
    cerrado_sin_regreso    = Column(Boolean, nullable=False, default=False)
    motivo_sin_regreso     = Column(Text)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class DriverOffer(Base):
    __tablename__ = "DriverOffer"

    offer_id        = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id      = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    driver_id       = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    vehicle_id      = Column(Integer, ForeignKey("Vehicle.vehicle_id", ondelete="CASCADE"), nullable=False)
    offered_price   = Column(Numeric(10, 2), nullable=False)
    status          = Column(Enum(
        'DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED', 'ACCEPTED', 'REJECTED',
        name='offer_status'
    ), default='DRIVER_OFFERED')
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TripPassenger(Base):
    __tablename__ = "TripPassenger"
    __table_args__ = (
        CheckConstraint("char_length(full_name) >= 3", name="ck_tp_name_len"),
        CheckConstraint(
            "(document_type IN ('CC','TI') AND document_number ~ '^[0-9]{5,10}$') OR "
            "(document_type IN ('CE','PA') AND document_number ~ '^[A-Za-z0-9]{5,15}$')",
            name="ck_tp_document",
        ),
    )

    passenger_entry_id  = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id          = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    full_name           = Column(String(100), nullable=False)
    document_type       = Column(Enum('CC', 'TI', 'CE', 'PA', name='doc_id_type'), default='CC')
    document_number     = Column(String(20), nullable=False)
    # El representante del viaje es siempre el pasajero que lo publicó
    # (request_id -> ServiceRequest.passenger_id), mayor de edad -- este
    # campo solo diferencia CUÁL de los ocupantes registrados es esa persona,
    # para el FUEC. Debe haber como máximo uno en True por viaje (ver
    # TripPassengersCreate en schemas.py).
    es_representante    = Column(Boolean, default=False)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "AuditLog"

    log_id      = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("User.user_id", ondelete="SET NULL"), nullable=True)
    action      = Column(String(50), nullable=False)
    entity      = Column(String(50))
    entity_id   = Column(Integer)
    detail      = Column(Text)
    ip_address  = Column(String(45))
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "Notification"

    notification_id     = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id             = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    title               = Column(String(100), nullable=False)
    message             = Column(Text, nullable=False)
    type                = Column(Enum(
        'NEW_OFFER', 'COUNTER_OFFER', 'TRIP_ACCEPTED', 'TRIP_REJECTED',
        'TRIP_STARTED', 'TRIP_COMPLETED', 'SYSTEM',
        name='notification_type'
    ), nullable=False)
    is_read             = Column(Boolean, default=False)
    related_offer_id    = Column(Integer, ForeignKey("DriverOffer.offer_id", ondelete="SET NULL"), nullable=True)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class PriceHistory(Base):
    """Historial de precios para entrenar el modelo de ML del precio sugerido
    (ÉPICA 12, HU29). Cada fila se crea automáticamente al completar un viaje
    — ver app/pricing/service.py::registrar_resultado_viaje."""
    __tablename__ = "PriceHistory"

    history_id          = Column(Integer, primary_key=True, autoincrement=True)
    request_id          = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="SET NULL"), nullable=True)
    vehicle_category    = Column(Enum('SEDAN', 'VAN', 'MICROBUS', 'BUS', 'BUS_GRANDE', name='vehicle_category'), nullable=False)
    distance_km         = Column(Numeric(10, 2), nullable=False)
    suggested_price     = Column(Numeric(10, 2), nullable=False)
    final_price         = Column(Numeric(10, 2))
    tolls_cost          = Column(Numeric(10, 2), default=0)
    wait_time_hours     = Column(Numeric(5, 2), default=0)
    num_days            = Column(Integer, default=1)
    is_peak_hour        = Column(Boolean, default=False)
    is_high_season      = Column(Boolean, default=False)
    tipo_via            = Column(Enum('PAVIMENTADA', 'DESTAPADA', 'MIXTA', name='via_type'))
    has_ac              = Column(Boolean, default=False)
    has_wifi            = Column(Boolean, default=False)
    num_passengers      = Column(Integer, nullable=False)
    origin_city         = Column(String(100))
    destination_city    = Column(String(100))
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TripStop(Base):
    """Paradas intermedias en un viaje"""
    __tablename__ = "TripStop"

    stop_id     = Column(Integer, primary_key=True, autoincrement=True)
    request_id  = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    stop_order  = Column(Integer, nullable=False)
    address     = Column(String(255), nullable=False)
    lat         = Column(Numeric(10, 8))
    lng         = Column(Numeric(11, 8))
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Rating(Base):
    """Calificaciones bidireccionales pasajero ↔ conductor (Épica 7)"""
    __tablename__ = "Rating"
    __table_args__ = (
        CheckConstraint("score >= 1 AND score <= 5", name="ck_rating_score"),
    )

    rating_id   = Column(Integer, primary_key=True, autoincrement=True)
    request_id  = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False)
    rater_id    = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    rated_id    = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False)
    score       = Column(Integer, nullable=False)
    comment     = Column(Text)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ── ÉPICA 6 — Pagos (SCRUM-178) ──────────────────────────────────────────────
# Recorrido del dinero acordado con David (25 sep 2026): anticipo al confirmar
# y el resto directo al conductor en cada etapa del viaje. Ver app/pagos/.

class PagoViaje(Base):
    """SCRUM-258 — un pago del plan de un viaje confirmado. Cada oferta
    aceptada tiene su propio plan: si el conductor cancela y otro toma el
    viaje, el plan viejo queda con la devolución del anticipo y el nuevo
    arranca de cero.

    canal DIRECTO = se le paga al conductor en efectivo o por transferencia y
    lo confirma quien recibe la plata; APP = pasa por la pasarela (Wompi,
    SCRUM-179, todavía sin integrar — por eso RETENIDO/LIBERADO/REEMBOLSADO
    no se usan aún)."""
    __tablename__ = "PagoViaje"
    __table_args__ = (
        CheckConstraint("hito IN ('ANTICIPO', 'LLEGADA_DESTINO', 'RECOGIDA_REGRESO')", name="ck_pago_hito"),
        CheckConstraint("canal IN ('DIRECTO', 'APP')", name="ck_pago_canal"),
        CheckConstraint(
            "estado IN ('PENDIENTE', 'PAGO_REPORTADO', 'CONFIRMADO', 'EN_RECLAMO', "
            "'DEVOLUCION_PENDIENTE', 'DEVOLUCION_REPORTADA', 'DEVUELTO', 'ANULADO', "
            "'RETENIDO', 'LIBERADO', 'REEMBOLSADO')",
            name="ck_pago_estado",
        ),
        CheckConstraint("monto >= 0 AND comision >= 0 AND comision <= monto", name="ck_pago_montos"),
        UniqueConstraint("offer_id", "hito", name="uq_pago_oferta_hito"),
    )

    pago_id        = Column(Integer, primary_key=True, autoincrement=True)
    request_id     = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False, index=True)
    offer_id       = Column(Integer, ForeignKey("DriverOffer.offer_id", ondelete="CASCADE"), nullable=False)
    driver_id      = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False, index=True)
    hito           = Column(String(20), nullable=False)
    orden          = Column(Integer, nullable=False)
    porcentaje     = Column(Numeric(5, 2), nullable=False)
    monto          = Column(Numeric(12, 2), nullable=False)
    # La comisión de Turify va entera en el anticipo (es de donde se descuenta).
    comision       = Column(Numeric(12, 2), nullable=False, default=0)
    canal          = Column(String(10), nullable=False, default='DIRECTO')
    estado         = Column(String(25), nullable=False, default='PENDIENTE')
    # Estado que tenía antes de entrar a EN_RECLAMO — dice si el reclamo es
    # sobre un pago o sobre una devolución, y a dónde vuelve si se rechaza.
    estado_previo  = Column(String(25))
    # Desde cuándo se debe (el anticipo al confirmar, los demás al llegar a
    # su etapa). NULL = todavía no toca pagarlo.
    exigible_desde = Column(TIMESTAMP(timezone=True))
    reportado_at   = Column(TIMESTAMP(timezone=True))
    confirmado_at  = Column(TIMESTAMP(timezone=True))
    created_at     = Column(TIMESTAMP(timezone=True), server_default=func.now())


class EventoViaje(Base):
    """SCRUM-260 — bitácora del viaje: cada abordaje, llegada, pago reportado,
    confirmación, devolución y reclamo, con quién lo hizo y la última
    ubicación del conductor. Solo se inserta: la migración
    2026-09-26_pagos_por_etapas.sql pone un trigger que rechaza UPDATE y
    DELETE (salvo los que llegan en cascada al borrar el viaje o el usuario)."""
    __tablename__ = "EventoViaje"

    evento_id  = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False, index=True)
    pago_id    = Column(Integer, ForeignKey("PagoViaje.pago_id", ondelete="CASCADE"))
    tipo       = Column(String(40), nullable=False)
    actor_id   = Column(Integer, ForeignKey("User.user_id", ondelete="SET NULL"))
    monto      = Column(Numeric(12, 2))
    lat        = Column(Numeric(10, 8))
    lng        = Column(Numeric(11, 8))
    detalle    = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Reclamo(Base):
    """SCRUM-264 — desacuerdo sobre un pago (o sobre el viaje) que resuelve
    un administrador con las pruebas de la bitácora."""
    __tablename__ = "Reclamo"
    __table_args__ = (
        CheckConstraint("estado IN ('ABIERTO', 'RESUELTO')", name="ck_reclamo_estado"),
    )

    reclamo_id   = Column(Integer, primary_key=True, autoincrement=True)
    request_id   = Column(Integer, ForeignKey("ServiceRequest.request_id", ondelete="CASCADE"), nullable=False, index=True)
    pago_id      = Column(Integer, ForeignKey("PagoViaje.pago_id", ondelete="CASCADE"))
    abierto_por  = Column(Integer, ForeignKey("User.user_id", ondelete="SET NULL"))
    motivo       = Column(Text, nullable=False)
    estado       = Column(String(10), nullable=False, default='ABIERTO')
    decision     = Column(String(30))
    resolucion   = Column(Text)
    resuelto_por = Column(Integer, ForeignKey("User.user_id", ondelete="SET NULL"))
    resuelto_at  = Column(TIMESTAMP(timezone=True))
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())


class CuentaPagoConductor(Base):
    """SCRUM-263 — cuenta a nombre del conductor donde recibe los pagos. Toda
    cuenta nueva o cambiada queda pendiente hasta que un administrador la
    compara con la cédula; solo una cuenta verificada se le muestra al
    pasajero."""
    __tablename__ = "CuentaPagoConductor"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('NEQUI', 'DAVIPLATA', 'BANCOLOMBIA_AHORROS', 'BANCOLOMBIA_CORRIENTE', 'OTRO_BANCO')",
            name="ck_cuenta_tipo",
        ),
        CheckConstraint("estado IN ('PENDIENTE_VERIFICACION', 'VERIFICADA', 'RECHAZADA')", name="ck_cuenta_estado"),
        CheckConstraint("numero ~ '^[0-9]{6,20}$'", name="ck_cuenta_numero"),
        CheckConstraint("titular_documento ~ '^[0-9]{5,10}$'", name="ck_cuenta_documento"),
    )

    cuenta_id         = Column(Integer, primary_key=True, autoincrement=True)
    driver_id         = Column(Integer, ForeignKey("User.user_id", ondelete="CASCADE"), nullable=False, unique=True)
    tipo              = Column(String(25), nullable=False)
    banco             = Column(String(60))
    numero            = Column(String(20), nullable=False)
    titular_nombre    = Column(String(100), nullable=False)
    titular_documento = Column(String(10), nullable=False)
    estado            = Column(String(25), nullable=False, default='PENDIENTE_VERIFICACION')
    nota_admin        = Column(Text)
    verificada_por    = Column(Integer, ForeignKey("User.user_id", ondelete="SET NULL"))
    verificada_at     = Column(TIMESTAMP(timezone=True))
    created_at        = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at        = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())