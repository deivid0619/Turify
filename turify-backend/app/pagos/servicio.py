"""Plan de pagos, código de abordaje y bitácora de un viaje (SCRUM-258/259/260).

Nada de esto hace commit por su cuenta salvo donde se dice: el endpoint que lo
llama agrega sus propios cambios y hace un solo commit, igual que el resto del
router de viajes.
"""
import hmac
import math
import re
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.pagos import reglas, wompi

# Estados en los que la plata ya salió del bolsillo del pasajero (aunque el
# conductor no la haya confirmado todavía).
ESTADOS_PAGADO = ("PAGO_REPORTADO", "CONFIRMADO", "RETENIDO", "LIBERADO")
ESTADOS_DEVOLUCION = ("DEVOLUCION_PENDIENTE", "DEVOLUCION_REPORTADA")


def ahora():
    return datetime.now(timezone.utc)


def con_zona(fecha):
    """Las columnas son TIMESTAMP WITH TIME ZONE, pero por si llega una fecha
    sin zona se asume UTC en vez de reventar al compararla."""
    if fecha is None:
        return None
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def pesos(valor) -> int:
    return int(Decimal(str(valor or 0)))


def cop(valor) -> str:
    """$816.100 — separador de miles con punto, como se escribe en Colombia."""
    return "$" + f"{pesos(valor):,}".replace(",", ".")


# ── Consultas ────────────────────────────────────────────────────────────────

def oferta_aceptada(db: Session, request_id: int):
    return db.query(models.DriverOffer).filter(
        models.DriverOffer.request_id == request_id,
        models.DriverOffer.status == "ACCEPTED",
    ).first()


def pagos_de_oferta(db: Session, offer_id: int):
    return db.query(models.PagoViaje).filter(
        models.PagoViaje.offer_id == offer_id
    ).order_by(models.PagoViaje.orden).all()


def pago_de_hito(db: Session, offer_id: int, hito: str):
    return db.query(models.PagoViaje).filter(
        models.PagoViaje.offer_id == offer_id,
        models.PagoViaje.hito == hito,
    ).first()


# ── Bitácora ─────────────────────────────────────────────────────────────────

def registrar_evento(db: Session, request_id: int, tipo: str, *, actor=None, pago=None,
                     monto=None, detalle=None, gps_de=None):
    """Agrega una fila a la bitácora del viaje. `gps_de` es el conductor cuya
    última ubicación conocida queda como prueba (abordajes y llegadas)."""
    evento = models.EventoViaje(
        request_id=request_id,
        pago_id=pago.pago_id if pago is not None else None,
        tipo=tipo,
        actor_id=actor.user_id if actor is not None else None,
        monto=monto,
        detalle=detalle,
    )
    if gps_de is not None and gps_de.current_lat is not None and gps_de.current_lng is not None:
        evento.lat = gps_de.current_lat
        evento.lng = gps_de.current_lng
    db.add(evento)
    return evento


def notificar(db: Session, user_id: int, titulo: str, mensaje: str, offer_id: int = None):
    """Igual que crear_notificacion del router de viajes (commit propio, nunca
    tumba el flujo principal); está acá para no importar el router."""
    try:
        db.add(models.Notification(
            user_id=user_id, title=titulo[:100], message=mensaje, type="SYSTEM",
            related_offer_id=offer_id,
        ))
        db.commit()
    except Exception as e:  # noqa: BLE001 — la notificación es accesoria
        db.rollback()
        print(f"[Notificación] Error: {e}")


# ── Plan de pagos (SCRUM-258) ────────────────────────────────────────────────

def generar_codigo() -> str:
    return f"{secrets.randbelow(10000):04d}"


def crear_plan(db: Session, viaje, oferta, actor=None) -> bool:
    """Crea los pagos del plan de la oferta aceptada y el código de abordaje
    de la ida. Idempotente: si la oferta ya tiene plan, no hace nada."""
    db.flush()  # la oferta de precio fijo se crea en la misma transacción
    if pago_de_hito(db, oferta.offer_id, "ANTICIPO") is not None:
        return False

    precio = Decimal(str(oferta.offered_price))
    ida_y_vuelta = viaje.trip_type == "ROUND_TRIP"
    canal = reglas.canal_anticipo()
    porcentaje_comision, motivo_comision = reglas.comision_vigente(canal)
    reparto = reglas.repartir(precio, reglas.hitos_para(ida_y_vuelta))
    anticipo = reparto[0][2]
    comision = reglas.calcular_comision(precio, porcentaje_comision, tope=anticipo)
    momento = ahora()

    for orden, (hito, porcentaje, monto) in enumerate(reparto, start=1):
        es_anticipo = hito == "ANTICIPO"
        db.add(models.PagoViaje(
            request_id=viaje.request_id,
            offer_id=oferta.offer_id,
            driver_id=oferta.driver_id,
            hito=hito,
            orden=orden,
            porcentaje=porcentaje,
            monto=monto,
            comision=comision if es_anticipo else Decimal("0"),
            canal=canal if es_anticipo else "DIRECTO",
            estado="PENDIENTE",
            exigible_desde=momento if es_anticipo else None,
        ))

    viaje.codigo_abordaje = generar_codigo()
    viaje.codigo_intentos = 0
    viaje.codigo_bloqueado_hasta = None
    viaje.tramo = None
    db.flush()

    registrar_evento(
        db, viaje.request_id, "VIAJE_CONFIRMADO", actor=actor, monto=precio,
        detalle=(f"Precio acordado {cop(precio)}. Anticipo {reparto[0][1]:.0f} % ({cop(anticipo)}). "
                 f"Comisión de Turify: {cop(comision)} ({TEXTO_MOTIVO_COMISION[motivo_comision]})."),
    )
    return True


def asegurar_plan(db: Session, viaje, oferta) -> None:
    """Los viajes confirmados antes de que existiera el plan de pagos no lo
    tienen. Se crea la primera vez que alguien los mira, pero solo si todavía
    no arrancaron: a un viaje en curso o completado no se le inventan pagos
    pendientes que seguramente ya se arreglaron por fuera."""
    if oferta is None or viaje.status != "ASSIGNED":
        return
    if crear_plan(db, viaje, oferta):
        db.commit()
    elif not viaje.codigo_abordaje and viaje.tramo is None:
        viaje.codigo_abordaje = generar_codigo()
        db.commit()


def marcar_exigible(db: Session, oferta, hito: str):
    """El pago de esa etapa pasa a deberse desde ya."""
    pago = pago_de_hito(db, oferta.offer_id, hito)
    if pago is not None and pago.exigible_desde is None:
        pago.exigible_desde = ahora()
    return pago


# ── Código de abordaje (SCRUM-259) ───────────────────────────────────────────

def validar_codigo(db: Session, viaje, codigo: str | None, conductor) -> None:
    """Valida el código que el pasajero le dicta al conductor. Si falla,
    cuenta el intento (con commit, porque después se lanza la excepción) y a
    los 5 intentos lo bloquea 15 minutos y le avisa al pasajero."""
    momento = ahora()
    bloqueado_hasta = con_zona(viaje.codigo_bloqueado_hasta)
    if bloqueado_hasta and bloqueado_hasta > momento:
        minutos = max(1, math.ceil((bloqueado_hasta - momento).total_seconds() / 60))
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos con el código. Espera {minutos} min y pídele al pasajero que lo revise en su app.",
        )

    if not viaje.codigo_abordaje:
        viaje.codigo_abordaje = generar_codigo()
        db.commit()
        raise HTTPException(status_code=400, detail="Pídele al pasajero el código de abordaje que ve en su app.")

    codigo = (codigo or "").strip()
    if not codigo:
        raise HTTPException(status_code=400, detail="Escribe el código de abordaje que te dice el pasajero.")

    if not hmac.compare_digest(codigo, viaje.codigo_abordaje):
        viaje.codigo_intentos = (viaje.codigo_intentos or 0) + 1
        restantes = reglas.MAX_INTENTOS_CODIGO - viaje.codigo_intentos
        registrar_evento(db, viaje.request_id, "CODIGO_INCORRECTO", actor=conductor, gps_de=conductor,
                         detalle=f"Intento {viaje.codigo_intentos} de {reglas.MAX_INTENTOS_CODIGO}.")
        if restantes <= 0:
            viaje.codigo_intentos = 0
            viaje.codigo_bloqueado_hasta = momento + timedelta(minutes=reglas.MINUTOS_BLOQUEO_CODIGO)
            registrar_evento(db, viaje.request_id, "CODIGO_BLOQUEADO", actor=conductor,
                             detalle=f"Bloqueado {reglas.MINUTOS_BLOQUEO_CODIGO} minutos por intentos fallidos.")
            db.commit()
            notificar(db, viaje.passenger_id, "Intentaron usar tu código de abordaje",
                      f"El conductor escribió mal el código de abordaje {reglas.MAX_INTENTOS_CODIGO} veces "
                      f"y quedó bloqueado {reglas.MINUTOS_BLOQUEO_CODIGO} minutos. Solo díselo en persona, al subir.")
            raise HTTPException(
                status_code=429,
                detail=f"Código incorrecto. Se bloqueó {reglas.MINUTOS_BLOQUEO_CODIGO} minutos por seguridad.",
            )
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Código incorrecto. Te {'queda' if restantes == 1 else 'quedan'} {restantes} "
                   f"{'intento' if restantes == 1 else 'intentos'}.",
        )

    # Usado: se borra para que no sirva dos veces.
    viaje.codigo_abordaje = None
    viaje.codigo_intentos = 0
    viaje.codigo_bloqueado_hasta = None


# ── Cancelación (SCRUM-181) ──────────────────────────────────────────────────

def _estaba_pagado(pago) -> bool:
    if pago.estado == "EN_RECLAMO":
        return pago.estado_previo in ESTADOS_PAGADO
    return pago.estado in ESTADOS_PAGADO


def aplicar_cancelacion(db: Session, viaje, oferta, *, por_pasajero: bool, fuerza_mayor: bool,
                        horas_restantes: float, actor) -> dict:
    """Aplica la política de cancelación al plan de la oferta aceptada:

    - Pasajero con menos de 24 h y sin fuerza mayor: pierde el anticipo que ya
      pagó, que queda para el conductor como compensación (sin comisión).
    - En cualquier otro caso: todo lo pagado se devuelve.
    - Lo que no se había pagado se anula: no hay nada que retener.

    Un pago en reclamo no se toca: lo resuelve el administrador.
    """
    pagos = pagos_de_oferta(db, oferta.offer_id)
    anticipo = next((p for p in pagos if p.hito == "ANTICIPO"), None)
    anticipo_pagado = anticipo is not None and _estaba_pagado(anticipo)
    conserva_anticipo = (por_pasajero and not fuerza_mayor
                         and horas_restantes < reglas.HORAS_CANCELACION_LIBRE and anticipo_pagado)

    a_devolver = Decimal("0")
    reembolso_turify = Decimal("0")
    for pago in pagos:
        if pago.estado == "EN_RECLAMO" or pago.estado in ESTADOS_DEVOLUCION:
            continue  # ya va camino a resolverse (administrador o devolución en curso)
        if pago.estado in ("DEVUELTO", "ANULADO", "LIBERADO", "REEMBOLSADO"):
            continue
        if pago is anticipo and conserva_anticipo:
            if pago.comision:
                pago.comision = Decimal("0")  # la penalización es del conductor, sin comisión
            registrar_evento(db, viaje.request_id, "ANTICIPO_COMPENSACION", actor=actor, pago=pago, monto=pago.monto,
                             detalle="El pasajero canceló con menos de 24 horas: el anticipo queda para el conductor."
                                     + (" Turify se lo entrega." if pago.canal == "APP" else ""))
        elif _estaba_pagado(pago):
            pago.estado = "DEVOLUCION_PENDIENTE"
            pago.reportado_at = None
            pago.confirmado_at = None
            a_devolver += Decimal(pago.monto)
            if pago.canal == "APP":
                reembolso_turify += Decimal(pago.monto)
            registrar_evento(db, viaje.request_id, "DEVOLUCION_PENDIENTE", actor=actor, pago=pago, monto=pago.monto,
                             detalle="Turify le devuelve al pasajero lo que pagó en la app." if pago.canal == "APP"
                             else "El conductor debe devolverle este pago al pasajero.")
        else:
            pago.estado = "ANULADO"
            registrar_evento(db, viaje.request_id, "PAGO_ANULADO", actor=actor, pago=pago, monto=pago.monto,
                             detalle="No se había pagado y el viaje se canceló.")

    return {
        "penalty_percentage": float(anticipo.porcentaje) if conserva_anticipo else 0,
        "penalty_amount": pesos(anticipo.monto) if conserva_anticipo else 0,
        "anticipo_pagado": anticipo_pagado,
        "monto_a_devolver": pesos(a_devolver),
        # La parte que estaba en la app la devuelve Turify, no el conductor.
        "reembolso_turify": pesos(reembolso_turify),
    }


# ── Pago en línea con Wompi (SCRUM-179/180) ──────────────────────────────────

# Estado de la transacción en Wompi → tipo de evento en la bitácora.
_EVENTO_WOMPI = {
    "APPROVED": "PAGO_EN_LINEA_APROBADO",
    "DECLINED": "PAGO_EN_LINEA_RECHAZADO",
    "ERROR": "PAGO_EN_LINEA_RECHAZADO",
    "VOIDED": "PAGO_EN_LINEA_ANULADO",
}
_METODO_WOMPI = {
    "CARD": "tarjeta", "PSE": "PSE", "NEQUI": "Nequi", "BANCOLOMBIA_TRANSFER": "Botón Bancolombia",
    "BANCOLOMBIA_QR": "QR Bancolombia", "DAVIPLATA": "Daviplata", "BANCOLOMBIA_COLLECT": "Corresponsal Bancolombia",
}


def _evento_de_transaccion(db: Session, pago, tipos, transaccion_id: str):
    """¿Ya quedó en la bitácora este resultado de esta transacción? Así el
    mismo aviso de Wompi (que puede llegar por el webhook y por el regreso
    del pasajero, o repetido) se aplica una sola vez."""
    return db.query(models.EventoViaje.evento_id).filter(
        models.EventoViaje.pago_id == pago.pago_id,
        models.EventoViaje.tipo.in_(tipos),
        models.EventoViaje.detalle.like(f"Wompi {transaccion_id} ·%"),
    ).first() is not None


def procesar_transaccion(db: Session, transaccion: dict):
    """Aplica al anticipo el resultado de una transacción de Wompi (ya
    verificada: consultada en su API o llegada en un evento firmado) y hace
    commit. Devuelve (pago, viaje), o None si la transacción no es de un
    anticipo de Turify.

    - Aprobada sobre un anticipo pendiente: queda RETENIDO por Turify hasta
      que lleguen al destino.
    - Aprobada cuando el anticipo ya no se debía (el viaje se canceló
      mientras pagaba): queda para reembolsárselo al pasajero.
    - Aprobada cuando el anticipo ya estaba pagado: pago doble; se abre un
      reclamo para que el administrador reembolse el sobrante.
    - Rechazada: el anticipo sigue pendiente y el pasajero puede reintentar.
    - Anulada (el admin la anuló en Wompi para devolver la plata): si era la
      que pagó el anticipo, queda reembolsado o vuelve a estar pendiente.
    """
    referencia = wompi.leer_referencia(str(transaccion.get("reference") or ""))
    transaccion_id = str(transaccion.get("id") or "")
    if referencia is None or not wompi.id_transaccion_valido(transaccion_id):
        return None
    request_id, pago_id = referencia
    # Bloquea la fila: el webhook y el regreso del pasajero pueden llegar a la vez.
    pago = db.query(models.PagoViaje).filter(models.PagoViaje.pago_id == pago_id).with_for_update().first()
    if pago is None or pago.request_id != request_id or pago.hito != "ANTICIPO" or pago.canal != "APP":
        return None
    viaje = db.get(models.ServiceRequest, request_id)

    estado = transaccion.get("status")
    tipo = _EVENTO_WOMPI.get(estado)
    if tipo is None:  # PENDING: todavía no hay resultado
        db.rollback()
        return pago, viaje
    tipos_aprobado = ("PAGO_EN_LINEA_APROBADO", "PAGO_EN_LINEA_TARDIO", "PAGO_EN_LINEA_DUPLICADO")
    if _evento_de_transaccion(db, pago, tipos_aprobado if estado == "APPROVED" else (tipo,), transaccion_id):
        db.rollback()
        return pago, viaje

    centavos = pesos(pago.monto) * 100
    try:
        centavos_wompi = int(transaccion.get("amount_in_cents"))
    except (TypeError, ValueError):
        centavos_wompi = -1
    if transaccion.get("currency") != "COP" or centavos_wompi != centavos:
        # No debería pasar (el monto va firmado), pero si pasa no se toca el pago.
        print(f"[Wompi] Transacción {transaccion_id} con monto o moneda distintos al pago {pago_id}; se ignora.")
        db.rollback()
        return pago, viaje

    metodo = (_METODO_WOMPI.get(transaccion.get("payment_method_type"))
              or transaccion.get("payment_method_type") or "pago en línea")
    origen = f"Wompi {transaccion_id} · {metodo}"
    ruta = f"{viaje.origin} → {viaje.destination}"
    avisos = []  # (usuario, título, mensaje) — se mandan después del commit

    if estado == "APPROVED" and pago.estado == "PENDIENTE":
        pago.estado = "RETENIDO"
        pago.reportado_at = ahora()
        registrar_evento(db, request_id, "PAGO_EN_LINEA_APROBADO", pago=pago, monto=pago.monto,
                         detalle=f"{origen}: {cop(pago.monto)}. Turify lo retiene hasta que lleguen al destino.")
        neto = pesos(pago.monto) - pesos(pago.comision)
        avisos.append((viaje.passenger_id, "Recibimos tu anticipo",
                       f"Pagaste {cop(pago.monto)} del viaje {ruta}. Turify lo guarda y se lo entrega al "
                       "conductor cuando lleguen al destino."))
        avisos.append((pago.driver_id, "El pasajero pagó el anticipo en la app",
                       f"Turify recibió {cop(pago.monto)} del viaje {ruta}. Te transferimos {cop(neto)} "
                       "(descontada la comisión) cuando lleguen al destino."))
    elif estado == "APPROVED" and pago.estado == "ANULADO":
        pago.estado = "DEVOLUCION_PENDIENTE"
        registrar_evento(db, request_id, "PAGO_EN_LINEA_TARDIO", pago=pago, monto=pago.monto,
                         detalle=f"{origen}: {cop(pago.monto)}. El anticipo ya no se debía (el viaje se canceló); "
                                 "Turify se lo devuelve al pasajero.")
        avisos.append((viaje.passenger_id, "Te devolvemos tu pago",
                       f"Pagaste {cop(pago.monto)} cuando el viaje {ruta} ya se había cancelado. "
                       "Turify te lo devuelve completo."))
    elif estado == "APPROVED":
        registrar_evento(db, request_id, "PAGO_EN_LINEA_DUPLICADO", pago=pago, monto=pago.monto,
                         detalle=f"{origen}: {cop(pago.monto)}. El anticipo ya estaba pagado; hay que reembolsar este cobro.")
        db.add(models.Reclamo(
            request_id=request_id, pago_id=pago.pago_id, abierto_por=None,
            motivo=f"Cobro doble del anticipo en Wompi (transacción {transaccion_id}, {cop(pago.monto)}). "
                   "Anúlala o reembólsala desde el panel de Wompi y resuelve este reclamo.",
        ))
        avisos.append((viaje.passenger_id, "Te cobramos dos veces el anticipo",
                       f"Ya habías pagado el anticipo del viaje {ruta}. Turify te devuelve el cobro repetido "
                       f"de {cop(pago.monto)}."))
    elif estado == "VOIDED":
        aprobada = _evento_de_transaccion(db, pago, ("PAGO_EN_LINEA_APROBADO", "PAGO_EN_LINEA_TARDIO"), transaccion_id)
        detalle = f"{origen}: {cop(pago.monto)}. Wompi anuló la transacción."
        if aprobada and pago.estado == "DEVOLUCION_PENDIENTE":
            pago.estado = "REEMBOLSADO"
            pago.confirmado_at = ahora()
            detalle += " Con eso quedó reembolsado al pasajero."
            avisos.append((viaje.passenger_id, "Te devolvimos tu pago",
                           f"Anulamos el cobro de {cop(pago.monto)} del viaje {ruta}. Según tu banco, puede "
                           "tardar unos días en verse."))
        elif aprobada and pago.estado == "RETENIDO":
            pago.estado = "PENDIENTE"
            pago.reportado_at = None
            detalle += " El anticipo vuelve a quedar por pagar."
            avisos.append((viaje.passenger_id, "Tu pago del anticipo se anuló",
                           f"El cobro de {cop(pago.monto)} del viaje {ruta} se anuló. Vuelve a pagarlo desde la app."))
        registrar_evento(db, request_id, "PAGO_EN_LINEA_ANULADO", pago=pago, monto=pago.monto, detalle=detalle)
    else:
        mensaje = str(transaccion.get("status_message") or "").strip()
        registrar_evento(db, request_id, "PAGO_EN_LINEA_RECHAZADO", pago=pago, monto=pago.monto,
                         detalle=f"{origen}: {cop(pago.monto)}. {mensaje or 'El medio de pago no lo aprobó.'}")
        if pago.estado == "PENDIENTE":
            avisos.append((viaje.passenger_id, "Tu pago no se aprobó",
                           f"El pago del anticipo del viaje {ruta} no se aprobó. Puedes intentarlo otra vez "
                           "con otro medio de pago."))

    db.commit()
    for usuario, titulo, mensaje in avisos:
        notificar(db, usuario, titulo, mensaje, pago.offer_id)
    return pago, viaje


def transaccion_aprobada(db: Session, pago):
    """(id, medio) de la transacción de Wompi con la que se pagó el
    anticipo, sacados de la bitácora — el admin los necesita para anularla o
    buscarla en el panel de Wompi."""
    evento = db.query(models.EventoViaje).filter(
        models.EventoViaje.pago_id == pago.pago_id,
        models.EventoViaje.tipo.in_(("PAGO_EN_LINEA_APROBADO", "PAGO_EN_LINEA_TARDIO")),
    ).order_by(models.EventoViaje.evento_id.desc()).first()
    m = re.match(r"^Wompi (\S+) · ([^:]+):", evento.detalle or "") if evento else None
    return (m.group(1), m.group(2)) if m else (None, None)


def anticipo_liberable(db: Session, pago, viaje):
    """(se_puede, motivo) para entregarle al conductor el anticipo que
    Turify retiene. Se libera al llegar al destino (o al terminar el viaje), o
    como compensación si el pasajero canceló tarde; nunca con un reclamo
    abierto en el viaje."""
    if pago.canal != "APP" or pago.estado != "RETENIDO":
        return False, "Este anticipo no está retenido por Turify."
    reclamo = db.query(models.Reclamo.reclamo_id).filter(
        models.Reclamo.request_id == viaje.request_id, models.Reclamo.estado == "ABIERTO",
    ).first()
    if reclamo is not None:
        return False, "Hay un reclamo abierto en el viaje: resuélvelo primero."
    if viaje.status == "CANCELLED":
        return True, "El pasajero canceló con menos de 24 horas: es la compensación del conductor."
    if viaje.llego_destino_at is not None or viaje.status == "COMPLETED":
        return True, "Ya llegaron al destino."
    return False, "Se entrega cuando lleguen al destino."


# ── Cuenta del conductor (SCRUM-263) ─────────────────────────────────────────

_PARTICULAS = {"de", "del", "la", "las", "los", "y", "da", "van"}


def _palabras_nombre(nombre: str) -> set:
    sin_tildes = unicodedata.normalize("NFKD", nombre or "").encode("ascii", "ignore").decode()
    return {p for p in re.split(r"[^a-z]+", sin_tildes.lower()) if len(p) >= 2 and p not in _PARTICULAS}


def mismo_titular(nombre_perfil: str, nombre_titular: str) -> bool:
    """¿La cuenta está a nombre del conductor? Se toleran segundos nombres y
    apellidos de más ("Juan Pérez" vs "Juan Carlos Pérez Gómez"), pero tienen
    que coincidir al menos dos palabras. El administrador lo confirma contra
    la cédula antes de verificar la cuenta."""
    a, b = _palabras_nombre(nombre_perfil), _palabras_nombre(nombre_titular)
    if not a or not b:
        return False
    return len(a & b) >= min(2, len(a), len(b))


TEXTO_TIPO_CUENTA = {
    "NEQUI": "Nequi",
    "DAVIPLATA": "Daviplata",
    "BANCOLOMBIA_AHORROS": "Bancolombia · ahorros",
    "BANCOLOMBIA_CORRIENTE": "Bancolombia · corriente",
    "OTRO_BANCO": "Cuenta bancaria",
}


def cuenta_de(db: Session, driver_id: int):
    return db.query(models.CuentaPagoConductor).filter(
        models.CuentaPagoConductor.driver_id == driver_id
    ).first()


def serializar_cuenta(cuenta, completa: bool = True):
    if cuenta is None:
        return None
    numero = cuenta.numero if completa else f"•••• {cuenta.numero[-4:]}"
    tipo_texto = TEXTO_TIPO_CUENTA.get(cuenta.tipo, cuenta.tipo)
    if cuenta.tipo == "OTRO_BANCO" and cuenta.banco:
        tipo_texto = cuenta.banco
    return {
        "cuenta_id": cuenta.cuenta_id,
        "tipo": cuenta.tipo,
        "tipo_texto": tipo_texto,
        "banco": cuenta.banco,
        "numero": numero,
        "titular_nombre": cuenta.titular_nombre,
        "estado": cuenta.estado,
        "nota_admin": cuenta.nota_admin,
    }


# ── Presentación ─────────────────────────────────────────────────────────────

TEXTO_MOTIVO_COMISION = {
    "SIN_PASARELA": "no se cobra mientras el anticipo se pague directo al conductor",
    "NORMAL": "se descuenta del anticipo pagado en la app",
}

TEXTO_EVENTO = {
    "VIAJE_CONFIRMADO": "Viaje confirmado",
    "CODIGO_INCORRECTO": "Código de abordaje incorrecto",
    "CODIGO_BLOQUEADO": "Código de abordaje bloqueado por intentos fallidos",
    "ABORDAJE_IDA": "El conductor recogió al grupo (código validado)",
    "LLEGADA_DESTINO": "Llegaron al destino",
    "ABORDAJE_REGRESO": "El conductor recogió al grupo para el regreso (código validado)",
    "VIAJE_FINALIZADO": "Viaje finalizado",
    "CERRADO_SIN_REGRESO": "Viaje cerrado sin regreso",
    "VIAJE_CANCELADO": "Viaje cancelado",
    "PAGO_REPORTADO": "El pasajero reportó el pago",
    "PAGO_CONFIRMADO": "El conductor confirmó que recibió el pago",
    "PAGO_NO_RECIBIDO": "El conductor dice que no recibió el pago",
    "PAGO_ANULADO": "Pago anulado",
    "ANTICIPO_COMPENSACION": "El anticipo quedó para el conductor como compensación",
    "DEVOLUCION_PENDIENTE": "Pendiente devolverle este pago al pasajero",
    "DEVOLUCION_REPORTADA": "El conductor reportó la devolución",
    "DEVOLUCION_CONFIRMADA": "El pasajero confirmó que recibió la devolución",
    "DEVOLUCION_NO_RECIBIDA": "El pasajero dice que no recibió la devolución",
    "RECLAMO_ABIERTO": "Se abrió un reclamo",
    "RECLAMO_RESUELTO": "Un administrador resolvió el reclamo",
    "PAGO_EN_LINEA_APROBADO": "El pasajero pagó el anticipo en la app",
    "PAGO_EN_LINEA_RECHAZADO": "El pago en la app no se aprobó",
    "PAGO_EN_LINEA_TARDIO": "Pago en la app de un anticipo que ya no se debía",
    "PAGO_EN_LINEA_DUPLICADO": "Cobro doble del anticipo en la app",
    "PAGO_EN_LINEA_ANULADO": "Wompi anuló un pago en la app",
    "ANTICIPO_LIBERADO": "Turify le entregó el anticipo al conductor",
    "ANTICIPO_REEMBOLSADO": "Turify le devolvió el anticipo al pasajero",
}


def etiqueta_hito(hito: str, ida_y_vuelta: bool) -> str:
    if hito == "ANTICIPO":
        return "Anticipo"
    if hito == "LLEGADA_DESTINO":
        return "Al llegar al destino" if ida_y_vuelta else "Al dejarlos en el destino"
    return "Al recogerlos para el regreso"


def momento_hito(hito: str, ida_y_vuelta: bool) -> str:
    if hito == "ANTICIPO":
        return "Se paga al confirmar el viaje"
    if hito == "LLEGADA_DESTINO":
        return "Se paga al llegar al destino" if ida_y_vuelta else "Se paga al dejarlos en el destino"
    return "Se paga cuando los recoge para volver"


def _texto_estado(pago, rol: str) -> str:
    exigible = pago.exigible_desde is not None
    es_pasajero = rol == "PASAJERO"
    if pago.canal == "APP":
        textos_app = {
            "PENDIENTE": ("Por pagar en la app" if exigible else "Todavía no toca") if es_pasajero
                         else ("El pasajero aún no lo paga en la app" if exigible else "Todavía no toca"),
            "RETENIDO": "Pagado en la app; Turify se lo entrega al conductor al llegar al destino" if es_pasajero
                        else "Pagado en la app; Turify te lo transfiere al llegar al destino",
            "LIBERADO": "Pagado en la app" if es_pasajero else "Turify te lo transfirió",
            "DEVOLUCION_PENDIENTE": "Turify te lo devuelve" if es_pasajero
                                    else "Turify se lo devuelve al pasajero",
            "REEMBOLSADO": "Turify te lo devolvió" if es_pasajero else "Turify se lo devolvió al pasajero",
        }
        if pago.estado in textos_app:
            return textos_app[pago.estado]
    textos = {
        "PENDIENTE": ("Por pagar" if exigible else "Todavía no toca") if es_pasajero
                     else ("Sin pagar" if exigible else "Todavía no toca"),
        "PAGO_REPORTADO": "Reportaste el pago; falta que el conductor confirme" if es_pasajero
                          else "El pasajero dice que ya pagó; confirma si lo recibiste",
        "CONFIRMADO": "Pagado (confirmado por el conductor)" if es_pasajero else "Recibido",
        "EN_RECLAMO": "En reclamo: lo revisa un administrador",
        "DEVOLUCION_PENDIENTE": "El conductor debe devolvértelo" if es_pasajero else "Debes devolvérselo al pasajero",
        "DEVOLUCION_REPORTADA": "El conductor dice que te lo devolvió; confirma si te llegó" if es_pasajero
                                else "Reportaste la devolución; falta que el pasajero confirme",
        "DEVUELTO": "Devuelto",
        "ANULADO": "Anulado",
        "RETENIDO": "Pagado en la app; Turify lo retiene hasta la llegada",
        "LIBERADO": "Pagado en la app y entregado al conductor",
        "REEMBOLSADO": "Reembolsado al pasajero",
    }
    return textos.get(pago.estado, pago.estado)


def acciones_de(pago, rol: str, plan_vigente: bool) -> list:
    """Botones que ve cada parte. Regla: quien recibe la plata es quien
    confirma; quien la entrega solo puede reportar que lo hizo."""
    exigible = pago.exigible_desde is not None
    acciones = []
    if rol == "PASAJERO":
        if plan_vigente and pago.estado == "PENDIENTE" and exigible:
            acciones.append("PAGAR_EN_LINEA" if pago.canal == "APP" else "REPORTAR_PAGO")
        # Lo que se pagó en la app lo devuelve Turify, no el conductor: el
        # pasajero no tiene nada que confirmar.
        if pago.canal == "DIRECTO" and pago.estado == "DEVOLUCION_REPORTADA":
            acciones += ["CONFIRMAR_DEVOLUCION", "DEVOLUCION_NO_RECIBIDA"]
        elif pago.canal == "DIRECTO" and pago.estado == "DEVOLUCION_PENDIENTE":
            acciones.append("DEVOLUCION_NO_RECIBIDA")
    elif rol == "CONDUCTOR":
        # Un pago que el pasajero reportó se puede confirmar (o disputar) aunque
        # el viaje se haya cancelado después: p. ej. el anticipo que queda como
        # compensación por una cancelación tardía.
        por_confirmar = pago.estado == "PAGO_REPORTADO" or (pago.estado == "PENDIENTE" and plan_vigente)
        if pago.canal == "DIRECTO" and exigible and por_confirmar:
            acciones += ["CONFIRMAR_RECIBIDO", "NO_RECIBIDO"]
        if pago.canal == "DIRECTO" and pago.estado == "DEVOLUCION_PENDIENTE":
            acciones.append("REPORTAR_DEVOLUCION")
    return acciones


def serializar_pago(pago, viaje, rol: str, plan_vigente: bool = True) -> dict:
    ida_y_vuelta = viaje.trip_type == "ROUND_TRIP"
    return {
        "pago_id": pago.pago_id,
        "hito": pago.hito,
        "etiqueta": etiqueta_hito(pago.hito, ida_y_vuelta),
        "momento": momento_hito(pago.hito, ida_y_vuelta),
        "porcentaje": float(pago.porcentaje),
        "monto": pesos(pago.monto),
        "comision": pesos(pago.comision),
        "neto_conductor": pesos(pago.monto) - pesos(pago.comision),
        "canal": pago.canal,
        "estado": pago.estado,
        "estado_texto": _texto_estado(pago, rol),
        "exigible": pago.exigible_desde is not None,
        "reportado_at": pago.reportado_at.isoformat() if pago.reportado_at else None,
        "confirmado_at": pago.confirmado_at.isoformat() if pago.confirmado_at else None,
        "acciones": acciones_de(pago, rol, plan_vigente),
    }


def serializar_bitacora(db: Session, request_id: int, viaje, para_admin: bool = False) -> list:
    eventos = db.query(models.EventoViaje).filter(
        models.EventoViaje.request_id == request_id
    ).order_by(models.EventoViaje.created_at, models.EventoViaje.evento_id).all()
    resultado = []
    for e in eventos:
        if e.actor_id is None:
            quien = "Turify"
        elif e.actor_id == viaje.passenger_id:
            quien = "Pasajero"
        else:
            actor = db.query(models.User.role).filter(models.User.user_id == e.actor_id).first()
            quien = "Administrador" if actor and actor[0] == "ADMIN" else "Conductor"
        fila = {
            "tipo": e.tipo,
            "texto": TEXTO_EVENTO.get(e.tipo, e.tipo),
            "quien": quien,
            "monto": pesos(e.monto) if e.monto is not None else None,
            "detalle": e.detalle,
            "con_ubicacion": e.lat is not None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        if para_admin:
            fila["lat"] = float(e.lat) if e.lat is not None else None
            fila["lng"] = float(e.lng) if e.lng is not None else None
        resultado.append(fila)
    return resultado


def serializar_reclamos(db: Session, request_id: int) -> list:
    reclamos = db.query(models.Reclamo).filter(
        models.Reclamo.request_id == request_id
    ).order_by(models.Reclamo.created_at.desc()).all()
    return [{
        "reclamo_id": r.reclamo_id,
        "pago_id": r.pago_id,
        "estado": r.estado,
        "motivo": r.motivo,
        "decision": r.decision,
        "resolucion": r.resolucion,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "resuelto_at": r.resuelto_at.isoformat() if r.resuelto_at else None,
    } for r in reclamos]


def _totales(pagos) -> dict:
    vivos = [p for p in pagos if p.estado not in ("ANULADO", "DEVUELTO", "REEMBOLSADO")]
    precio = sum(pesos(p.monto) for p in pagos)
    comision = sum(pesos(p.comision) for p in vivos)
    pagado = sum(pesos(p.monto) for p in vivos if p.estado in ("CONFIRMADO", "RETENIDO", "LIBERADO"))
    por_pagar = sum(pesos(p.monto) for p in vivos
                    if p.estado in ("PENDIENTE", "PAGO_REPORTADO")
                    or (p.estado == "EN_RECLAMO" and p.estado_previo in ("PENDIENTE", "PAGO_REPORTADO")))
    return {
        "precio": precio,
        "comision": comision,
        "neto_conductor": precio - comision,
        "pagado": pagado,
        "por_pagar": por_pagar,
    }


def serializar_plan(db: Session, viaje, rol: str, *, usuario=None, oferta=None,
                    incluir_bitacora: bool = False) -> dict | None:
    """Plan de pagos del viaje visto por `rol` (PASAJERO, CONDUCTOR o ADMIN).

    El plan "vigente" es el de la oferta aceptada. Los planes de conductores
    que cancelaron solo siguen apareciendo mientras tengan una devolución
    pendiente o en reclamo.
    """
    if oferta is None:
        oferta = oferta_aceptada(db, viaje.request_id)

    if rol == "CONDUCTOR" and usuario is not None and (oferta is None or oferta.driver_id != usuario.user_id):
        # Un conductor que canceló: ve su plan viejo (para devolver el anticipo).
        oferta_propia = db.query(models.PagoViaje.offer_id).filter(
            models.PagoViaje.request_id == viaje.request_id,
            models.PagoViaje.driver_id == usuario.user_id,
        ).order_by(models.PagoViaje.offer_id.desc()).first()
        oferta = db.get(models.DriverOffer, oferta_propia[0]) if oferta_propia else None

    pagos = pagos_de_oferta(db, oferta.offer_id) if oferta is not None else []
    plan_vigente = oferta is not None and oferta.status == "ACCEPTED" and viaje.status != "CANCELLED"

    otros = db.query(models.PagoViaje).filter(
        models.PagoViaje.request_id == viaje.request_id,
        models.PagoViaje.offer_id != (oferta.offer_id if oferta is not None else -1),
        models.PagoViaje.estado.in_(ESTADOS_DEVOLUCION + ("EN_RECLAMO",)),
    ).order_by(models.PagoViaje.pago_id).all() if rol in ("PASAJERO", "ADMIN") else []

    if not pagos and not otros:
        plan = None
    else:
        porcentaje_comision = None
        anticipo = next((p for p in pagos if p.hito == "ANTICIPO"), None)
        if anticipo is not None and pagos:
            precio = sum(pesos(p.monto) for p in pagos)
            porcentaje_comision = round(pesos(anticipo.comision) * 100 / precio, 2) if precio else 0
        plan = {
            "vigente": plan_vigente,
            "pagos": [serializar_pago(p, viaje, rol, plan_vigente) for p in pagos],
            "devoluciones_de_otros_conductores": [serializar_pago(p, viaje, rol, False) for p in otros],
            "comision_pct": porcentaje_comision,
            **_totales(pagos),
        }

    resultado = {
        "request_id": viaje.request_id,
        "trip_type": viaje.trip_type,
        "status": viaje.status,
        "tramo": viaje.tramo,
        "cerrado_sin_regreso": bool(viaje.cerrado_sin_regreso),
        "plan": plan,
    }

    if rol == "PASAJERO":
        codigo_visible = viaje.status == "ASSIGNED" or (viaje.status == "IN_PROGRESS" and viaje.tramo == "EN_DESTINO")
        bloqueado = con_zona(viaje.codigo_bloqueado_hasta)
        resultado["codigo_abordaje"] = viaje.codigo_abordaje if codigo_visible else None
        resultado["codigo_para"] = ("REGRESO" if viaje.tramo == "EN_DESTINO" else "IDA") if codigo_visible else None
        resultado["codigo_bloqueado_hasta"] = bloqueado.isoformat() if bloqueado and bloqueado > ahora() else None
        cuenta = None
        if oferta is not None and plan_vigente and viaje.status in ("ASSIGNED", "IN_PROGRESS"):
            cuenta_db = cuenta_de(db, oferta.driver_id)
            if cuenta_db is not None and cuenta_db.estado == "VERIFICADA":
                cuenta = serializar_cuenta(cuenta_db, completa=True)
        resultado["cuenta_conductor"] = cuenta

    if incluir_bitacora:
        resultado["bitacora"] = serializar_bitacora(db, viaje.request_id, viaje, para_admin=(rol == "ADMIN"))
        resultado["reclamos"] = serializar_reclamos(db, viaje.request_id)

    return resultado
