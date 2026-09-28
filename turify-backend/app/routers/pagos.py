"""ÉPICA 6 — Pagos (SCRUM-178): plan de pagos, doble confirmación, reclamos
y cuenta del conductor.

Regla de todo el módulo: quien recibe la plata es quien la confirma. El que
paga (o devuelve) solo puede reportar que lo hizo; si quien debía recibirla
dice que no le llegó, el pago queda en reclamo y lo resuelve un administrador
con la bitácora del viaje.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import registrar_log
from app.database import get_db
from app.pagos import servicio
from app.pagos.servicio import cop
from app.security import get_current_user

router = APIRouter(prefix="/api/pagos", tags=["Pagos"])


# ── Ayudas de permisos ───────────────────────────────────────────────────────

def _viaje(db: Session, request_id: int):
    viaje = db.get(models.ServiceRequest, request_id)
    if viaje is None:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    return viaje


def _pago(db: Session, pago_id: int):
    pago = db.get(models.PagoViaje, pago_id)
    if pago is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado.")
    return pago, _viaje(db, pago.request_id)


def _rol_en_viaje(db: Session, viaje, usuario) -> str | None:
    if usuario.role == "ADMIN":
        return "ADMIN"
    if viaje.passenger_id == usuario.user_id:
        return "PASAJERO"
    tiene_plan = db.query(models.PagoViaje.pago_id).filter(
        models.PagoViaje.request_id == viaje.request_id,
        models.PagoViaje.driver_id == usuario.user_id,
    ).first()
    if tiene_plan:
        return "CONDUCTOR"
    oferta = servicio.oferta_aceptada(db, viaje.request_id)
    if oferta is not None and oferta.driver_id == usuario.user_id:
        return "CONDUCTOR"
    return None


def _preparar(db: Session, pago_id: int, usuario, rol_esperado: str, accion: str):
    """Carga el pago, verifica que sea de quien llama y que su estado admita
    la acción (las mismas reglas que deciden qué botones ve cada parte)."""
    pago, viaje = _pago(db, pago_id)
    if rol_esperado == "PASAJERO" and viaje.passenger_id != usuario.user_id:
        raise HTTPException(status_code=403, detail="Solo el pasajero de este viaje puede hacer esto.")
    if rol_esperado == "CONDUCTOR" and pago.driver_id != usuario.user_id:
        raise HTTPException(status_code=403, detail="Solo el conductor de este pago puede hacer esto.")
    oferta = servicio.oferta_aceptada(db, viaje.request_id)
    plan_vigente = viaje.status != "CANCELLED" and oferta is not None and pago.offer_id == oferta.offer_id
    if accion not in servicio.acciones_de(pago, rol_esperado, plan_vigente):
        raise HTTPException(status_code=400, detail="Ese pago no admite esta acción en su estado actual.")
    return pago, viaje


def _respuesta(db: Session, viaje, rol: str, usuario):
    return servicio.serializar_plan(db, viaje, rol, usuario=usuario, incluir_bitacora=True)


def _abrir_reclamo(db: Session, viaje, pago, usuario, motivo: str):
    reclamo = models.Reclamo(
        request_id=viaje.request_id,
        pago_id=pago.pago_id if pago is not None else None,
        abierto_por=usuario.user_id,
        motivo=motivo,
    )
    db.add(reclamo)
    servicio.registrar_evento(db, viaje.request_id, "RECLAMO_ABIERTO", actor=usuario, pago=pago,
                              monto=pago.monto if pago is not None else None, detalle=motivo)
    return reclamo


# ── Ver el plan ──────────────────────────────────────────────────────────────

@router.get("/viajes/{request_id}")
def ver_plan(request_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Plan de pagos del viaje, con la bitácora y los reclamos, tal como lo ve
    quien pregunta (el código de abordaje y la cuenta del conductor solo los
    ve el pasajero)."""
    viaje = _viaje(db, request_id)
    rol = _rol_en_viaje(db, viaje, current_user)
    if rol is None:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver los pagos de este viaje.")
    servicio.asegurar_plan(db, viaje, servicio.oferta_aceptada(db, request_id))
    return _respuesta(db, viaje, rol, current_user)


@router.get("/pendientes")
def pagos_pendientes_fuera_de_viajes_activos(db: Session = Depends(get_db),
                                             current_user: models.User = Depends(get_current_user)):
    """Devoluciones, reclamos y pagos por confirmar de viajes que ya no salen
    en los listados normales: el viaje se canceló o volvió a quedar sin
    conductor porque el conductor canceló."""
    consulta = db.query(models.PagoViaje, models.ServiceRequest, models.DriverOffer).join(
        models.ServiceRequest, models.ServiceRequest.request_id == models.PagoViaje.request_id
    ).join(models.DriverOffer, models.DriverOffer.offer_id == models.PagoViaje.offer_id)

    if current_user.role == "DRIVER":
        rol = "CONDUCTOR"
        filas = consulta.filter(
            models.PagoViaje.driver_id == current_user.user_id,
            models.PagoViaje.estado.in_(servicio.ESTADOS_DEVOLUCION + ("EN_RECLAMO", "PAGO_REPORTADO")),
            (models.DriverOffer.status != "ACCEPTED") | (models.ServiceRequest.status == "CANCELLED"),
        ).all()
    else:
        rol = "PASAJERO"
        filas = consulta.filter(
            models.ServiceRequest.passenger_id == current_user.user_id,
            models.PagoViaje.estado.in_(servicio.ESTADOS_DEVOLUCION + ("EN_RECLAMO",)),
            models.ServiceRequest.status.in_(["PENDING", "CANCELLED"]),
        ).all()

    return [{
        "viaje": {
            "request_id": viaje.request_id,
            "origin": viaje.origin,
            "destination": viaje.destination,
            "departure_time": viaje.departure_time.isoformat() if viaje.departure_time else None,
            "status": viaje.status,
        },
        "pago": servicio.serializar_pago(pago, viaje, rol, plan_vigente=False),
    } for pago, viaje, _oferta in sorted(filas, key=lambda f: f[0].pago_id)]


# ── Pagos al conductor ───────────────────────────────────────────────────────

@router.post("/{pago_id}/reportar-pago")
def reportar_pago(pago_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """El pasajero avisa que ya le pagó al conductor (efectivo o transferencia)."""
    pago, viaje = _preparar(db, pago_id, current_user, "PASAJERO", "REPORTAR_PAGO")
    pago.estado = "PAGO_REPORTADO"
    pago.reportado_at = servicio.ahora()
    servicio.registrar_evento(db, viaje.request_id, "PAGO_REPORTADO", actor=current_user, pago=pago, monto=pago.monto,
                              detalle=f"{servicio.etiqueta_hito(pago.hito, viaje.trip_type == 'ROUND_TRIP')}: {cop(pago.monto)}.")
    db.commit()
    servicio.notificar(db, pago.driver_id, "El pasajero reporta un pago",
                       f"Dice que te pagó {cop(pago.monto)} del viaje {viaje.origin} → {viaje.destination}. "
                       "Confírmalo en la app cuando lo veas.", pago.offer_id)
    return _respuesta(db, viaje, "PASAJERO", current_user)


@router.post("/{pago_id}/confirmar-recibido")
def confirmar_recibido(pago_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """El conductor confirma que recibió el pago. Es lo que lo da por pagado."""
    pago, viaje = _preparar(db, pago_id, current_user, "CONDUCTOR", "CONFIRMAR_RECIBIDO")
    pago.estado = "CONFIRMADO"
    pago.confirmado_at = servicio.ahora()
    servicio.registrar_evento(db, viaje.request_id, "PAGO_CONFIRMADO", actor=current_user, pago=pago, monto=pago.monto,
                              gps_de=current_user,
                              detalle=f"{servicio.etiqueta_hito(pago.hito, viaje.trip_type == 'ROUND_TRIP')}: {cop(pago.monto)}.")
    db.commit()
    servicio.notificar(db, viaje.passenger_id, "El conductor confirmó tu pago",
                       f"Recibió {cop(pago.monto)} del viaje {viaje.origin} → {viaje.destination}.", pago.offer_id)
    return _respuesta(db, viaje, "CONDUCTOR", current_user)


@router.post("/{pago_id}/no-recibido")
def pago_no_recibido(pago_id: int, payload: schemas.MotivoOpcional | None = None,
                     db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """El conductor dice que no le ha llegado ese pago: queda en reclamo."""
    pago, viaje = _preparar(db, pago_id, current_user, "CONDUCTOR", "NO_RECIBIDO")
    motivo = (payload.motivo if payload and payload.motivo else None) or (
        "El pasajero reportó el pago pero no me ha llegado." if pago.estado == "PAGO_REPORTADO"
        else "El pasajero no me ha pagado.")
    pago.estado_previo = pago.estado
    pago.estado = "EN_RECLAMO"
    servicio.registrar_evento(db, viaje.request_id, "PAGO_NO_RECIBIDO", actor=current_user, pago=pago,
                              monto=pago.monto, gps_de=current_user, detalle=motivo)
    _abrir_reclamo(db, viaje, pago, current_user, motivo)
    db.commit()
    servicio.notificar(db, viaje.passenger_id, "Hay un reclamo sobre un pago",
                       f"El conductor dice que no ha recibido {cop(pago.monto)}. Un administrador de Turify "
                       "revisará el caso; si ya pagaste, ten a mano el comprobante.", pago.offer_id)
    return _respuesta(db, viaje, "CONDUCTOR", current_user)


# ── Devoluciones al pasajero ─────────────────────────────────────────────────

@router.post("/{pago_id}/reportar-devolucion")
def reportar_devolucion(pago_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """El conductor avisa que ya le devolvió la plata al pasajero."""
    pago, viaje = _preparar(db, pago_id, current_user, "CONDUCTOR", "REPORTAR_DEVOLUCION")
    pago.estado = "DEVOLUCION_REPORTADA"
    pago.reportado_at = servicio.ahora()
    servicio.registrar_evento(db, viaje.request_id, "DEVOLUCION_REPORTADA", actor=current_user, pago=pago,
                              monto=pago.monto, detalle=f"Devolución de {cop(pago.monto)}.")
    db.commit()
    servicio.notificar(db, viaje.passenger_id, "El conductor reporta una devolución",
                       f"Dice que te devolvió {cop(pago.monto)}. Confírmalo en la app cuando te llegue.", pago.offer_id)
    return _respuesta(db, viaje, "CONDUCTOR", current_user)


@router.post("/{pago_id}/confirmar-devolucion")
def confirmar_devolucion(pago_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """El pasajero confirma que le llegó la devolución."""
    pago, viaje = _preparar(db, pago_id, current_user, "PASAJERO", "CONFIRMAR_DEVOLUCION")
    pago.estado = "DEVUELTO"
    pago.confirmado_at = servicio.ahora()
    servicio.registrar_evento(db, viaje.request_id, "DEVOLUCION_CONFIRMADA", actor=current_user, pago=pago,
                              monto=pago.monto, detalle=f"Devolución de {cop(pago.monto)} recibida.")
    db.commit()
    servicio.notificar(db, pago.driver_id, "El pasajero confirmó la devolución",
                       f"Recibió los {cop(pago.monto)} que le devolviste.", pago.offer_id)
    return _respuesta(db, viaje, "PASAJERO", current_user)


@router.post("/{pago_id}/devolucion-no-recibida")
def devolucion_no_recibida(pago_id: int, payload: schemas.MotivoOpcional | None = None,
                           db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """El pasajero dice que la devolución no le ha llegado: queda en reclamo."""
    pago, viaje = _preparar(db, pago_id, current_user, "PASAJERO", "DEVOLUCION_NO_RECIBIDA")
    motivo = (payload.motivo if payload and payload.motivo else None) or (
        "El conductor reportó la devolución pero no me ha llegado." if pago.estado == "DEVOLUCION_REPORTADA"
        else "El conductor no me ha devuelto el dinero.")
    pago.estado_previo = pago.estado
    pago.estado = "EN_RECLAMO"
    servicio.registrar_evento(db, viaje.request_id, "DEVOLUCION_NO_RECIBIDA", actor=current_user, pago=pago,
                              monto=pago.monto, detalle=motivo)
    _abrir_reclamo(db, viaje, pago, current_user, motivo)
    db.commit()
    servicio.notificar(db, pago.driver_id, "Hay un reclamo sobre una devolución",
                       f"El pasajero dice que no ha recibido los {cop(pago.monto)} que debías devolverle. "
                       "Un administrador de Turify revisará el caso.", pago.offer_id)
    return _respuesta(db, viaje, "PASAJERO", current_user)


# ── Reclamos ─────────────────────────────────────────────────────────────────

@router.post("/viajes/{request_id}/reclamos", status_code=201)
def abrir_reclamo(request_id: int, payload: schemas.ReclamoCreate,
                  db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Reclamo libre sobre el viaje o uno de sus pagos (p. ej. "el conductor
    no volvió por nosotros"). No cambia el estado de ningún pago: lo decide
    el administrador."""
    viaje = _viaje(db, request_id)
    rol = _rol_en_viaje(db, viaje, current_user)
    if rol not in ("PASAJERO", "CONDUCTOR"):
        raise HTTPException(status_code=403, detail="Solo el pasajero o el conductor del viaje pueden abrir un reclamo.")
    if viaje.status == "PENDING" and not db.query(models.PagoViaje.pago_id).filter(
            models.PagoViaje.request_id == request_id).first():
        raise HTTPException(status_code=400, detail="Este viaje todavía no tiene pagos sobre los que reclamar.")

    pago = None
    if payload.pago_id is not None:
        pago = db.get(models.PagoViaje, payload.pago_id)
        if pago is None or pago.request_id != request_id:
            raise HTTPException(status_code=400, detail="Ese pago no es de este viaje.")
        if rol == "CONDUCTOR" and pago.driver_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Ese pago no es tuyo.")

    abiertos = db.query(models.Reclamo).filter(
        models.Reclamo.request_id == request_id,
        models.Reclamo.abierto_por == current_user.user_id,
        models.Reclamo.estado == "ABIERTO",
    ).count()
    if abiertos >= 3:
        raise HTTPException(status_code=400, detail="Ya tienes reclamos abiertos en este viaje; espera a que los revisemos.")

    _abrir_reclamo(db, viaje, pago, current_user, payload.motivo.strip())
    db.commit()
    return _respuesta(db, viaje, rol, current_user)


# ── Cuenta del conductor (SCRUM-263) ─────────────────────────────────────────

@router.get("/cuenta")
def ver_mi_cuenta(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores registran una cuenta de pagos.")
    return {"cuenta": servicio.serializar_cuenta(servicio.cuenta_de(db, current_user.user_id))}


@router.put("/cuenta")
def guardar_mi_cuenta(payload: schemas.CuentaPagoIn, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    if current_user.role != "DRIVER":
        raise HTTPException(status_code=403, detail="Solo los conductores registran una cuenta de pagos.")
    if not servicio.mismo_titular(current_user.full_name, payload.titular_nombre):
        raise HTTPException(
            status_code=400,
            detail=f"La cuenta tiene que estar a tu nombre ({current_user.full_name}). "
                   "Por seguridad no recibimos pagos en cuentas de terceros.",
        )

    cuenta = servicio.cuenta_de(db, current_user.user_id)
    nueva = cuenta is None
    if nueva:
        cuenta = models.CuentaPagoConductor(driver_id=current_user.user_id)
        db.add(cuenta)
    cuenta.tipo = payload.tipo.value
    cuenta.banco = payload.banco.strip() if payload.banco else None
    cuenta.numero = payload.numero
    cuenta.titular_nombre = payload.titular_nombre
    cuenta.titular_documento = payload.titular_documento
    # Toda cuenta nueva o cambiada vuelve a revisión: es el truco clásico para
    # desviar pagos (entrar a la cuenta de otro y cambiarle el número).
    cuenta.estado = "PENDIENTE_VERIFICACION"
    cuenta.nota_admin = None
    cuenta.verificada_por = None
    cuenta.verificada_at = None
    db.commit()

    registrar_log(db, action="CUENTA_PAGOS", user_id=current_user.user_id, entity="CuentaPagoConductor",
                  entity_id=cuenta.cuenta_id,
                  detail=f"{'Registró' if nueva else 'Cambió'} su cuenta de pagos ({cuenta.tipo} terminada en {cuenta.numero[-4:]}).")
    if not nueva:
        servicio.notificar(db, current_user.user_id, "Cambiaste tu cuenta de pagos",
                           f"Tu cuenta de pagos ahora termina en {cuenta.numero[-4:]} y queda en revisión. "
                           "Si no fuiste tú, cambia tu contraseña y escríbenos de inmediato.")
    return {"cuenta": servicio.serializar_cuenta(cuenta)}


# ── Administración ───────────────────────────────────────────────────────────

def _solo_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores.")
    return current_user


@router.get("/admin/reclamos")
def listar_reclamos(estado: str = Query("ABIERTO", pattern="^(ABIERTO|RESUELTO|TODOS)$"),
                    db: Session = Depends(get_db), admin: models.User = Depends(_solo_admin)):
    consulta = db.query(models.Reclamo)
    if estado != "TODOS":
        consulta = consulta.filter(models.Reclamo.estado == estado)
    reclamos = consulta.order_by(models.Reclamo.created_at.desc()).limit(100).all()

    resultado = []
    for r in reclamos:
        viaje = db.get(models.ServiceRequest, r.request_id)
        pago = db.get(models.PagoViaje, r.pago_id) if r.pago_id else None
        pasajero = db.get(models.User, viaje.passenger_id) if viaje else None
        conductor = db.get(models.User, pago.driver_id) if pago else None
        if conductor is None and viaje is not None:
            oferta = servicio.oferta_aceptada(db, viaje.request_id)
            conductor = db.get(models.User, oferta.driver_id) if oferta else None
        autor = db.get(models.User, r.abierto_por) if r.abierto_por else None
        resultado.append({
            "reclamo_id": r.reclamo_id,
            "estado": r.estado,
            "motivo": r.motivo,
            "decision": r.decision,
            "resolucion": r.resolucion,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "abierto_por": autor.full_name if autor else None,
            "abierto_por_rol": ("Pasajero" if viaje and r.abierto_por == viaje.passenger_id else "Conductor"),
            "viaje": {
                "request_id": viaje.request_id,
                "origin": viaje.origin,
                "destination": viaje.destination,
                "departure_time": viaje.departure_time.isoformat() if viaje.departure_time else None,
                "status": viaje.status,
                "trip_type": viaje.trip_type,
            } if viaje else None,
            "pasajero": {"nombre": pasajero.full_name, "telefono": pasajero.phone_number} if pasajero else None,
            "conductor": {"nombre": conductor.full_name, "telefono": conductor.phone_number} if conductor else None,
            "pago": servicio.serializar_pago(pago, viaje, "ADMIN", False) if pago and viaje else None,
            "pago_estado_previo": pago.estado_previo if pago else None,
            "bitacora": servicio.serializar_bitacora(db, viaje.request_id, viaje, para_admin=True) if viaje else [],
        })
    return resultado


_DESTINO_DECISION = {
    schemas.DecisionReclamo.PAGO_CONFIRMADO: "CONFIRMADO",
    schemas.DecisionReclamo.PAGO_PENDIENTE: "PENDIENTE",
    schemas.DecisionReclamo.ANULAR: "ANULADO",
    schemas.DecisionReclamo.DEVOLUCION_PENDIENTE: "DEVOLUCION_PENDIENTE",
    schemas.DecisionReclamo.DEVUELTO: "DEVUELTO",
}


@router.post("/admin/reclamos/{reclamo_id}/resolver")
def resolver_reclamo(reclamo_id: int, payload: schemas.ResolverReclamo,
                     db: Session = Depends(get_db), admin: models.User = Depends(_solo_admin)):
    reclamo = db.get(models.Reclamo, reclamo_id)
    if reclamo is None:
        raise HTTPException(status_code=404, detail="Reclamo no encontrado.")
    if reclamo.estado != "ABIERTO":
        raise HTTPException(status_code=400, detail="Ese reclamo ya fue resuelto.")

    viaje = _viaje(db, reclamo.request_id)
    pago = db.get(models.PagoViaje, reclamo.pago_id) if reclamo.pago_id else None
    destino = _DESTINO_DECISION.get(payload.decision)
    if destino is not None and pago is None:
        raise HTTPException(status_code=400, detail="Este reclamo no es sobre un pago: usa 'SIN_CAMBIOS'.")

    if destino is not None:
        pago.estado = destino
        pago.estado_previo = None
        if destino in ("CONFIRMADO", "DEVUELTO"):
            pago.confirmado_at = servicio.ahora()
        elif destino in ("PENDIENTE", "DEVOLUCION_PENDIENTE"):
            pago.reportado_at = None
            pago.confirmado_at = None
        # Otros reclamos abiertos sobre el mismo pago quedan resueltos con él.
        for otro in db.query(models.Reclamo).filter(
                models.Reclamo.pago_id == pago.pago_id,
                models.Reclamo.estado == "ABIERTO",
                models.Reclamo.reclamo_id != reclamo.reclamo_id).all():
            otro.estado = "RESUELTO"
            otro.decision = payload.decision.value
            otro.resolucion = payload.nota
            otro.resuelto_por = admin.user_id
            otro.resuelto_at = servicio.ahora()

    conductor_id = pago.driver_id if pago else None
    if conductor_id is None:
        oferta = servicio.oferta_aceptada(db, viaje.request_id)
        conductor_id = oferta.driver_id if oferta else None
    if payload.penalizar_conductor:
        if conductor_id is None:
            raise HTTPException(status_code=400, detail="No hay un conductor a quien aplicarle la penalización.")
        conductor = db.get(models.User, conductor_id)
        conductor.cancelaciones_injustificadas = (conductor.cancelaciones_injustificadas or 0) + 1

    reclamo.estado = "RESUELTO"
    reclamo.decision = payload.decision.value
    reclamo.resolucion = payload.nota
    reclamo.resuelto_por = admin.user_id
    reclamo.resuelto_at = servicio.ahora()
    servicio.registrar_evento(db, viaje.request_id, "RECLAMO_RESUELTO", actor=admin, pago=pago,
                              monto=pago.monto if pago else None,
                              detalle=f"Decisión: {payload.decision.value}. {payload.nota}"
                                      + (" Cuenta como cancelación injustificada del conductor." if payload.penalizar_conductor else ""))
    db.commit()

    registrar_log(db, action="RESOLVER_RECLAMO", user_id=admin.user_id, entity="Reclamo", entity_id=reclamo.reclamo_id,
                  detail=f"Viaje #{viaje.request_id}: {payload.decision.value}")
    mensaje = f"Resolvimos el reclamo del viaje {viaje.origin} → {viaje.destination}: {payload.nota}"
    servicio.notificar(db, viaje.passenger_id, "Reclamo resuelto", mensaje)
    if conductor_id is not None:
        servicio.notificar(db, conductor_id, "Reclamo resuelto", mensaje)
    return {"reclamo_id": reclamo.reclamo_id, "estado": reclamo.estado, "decision": reclamo.decision,
            "pago_estado": pago.estado if pago else None}


@router.get("/admin/cuentas")
def listar_cuentas(estado: str = Query("PENDIENTE_VERIFICACION",
                                       pattern="^(PENDIENTE_VERIFICACION|VERIFICADA|RECHAZADA|TODAS)$"),
                   db: Session = Depends(get_db), admin: models.User = Depends(_solo_admin)):
    consulta = db.query(models.CuentaPagoConductor, models.User).join(
        models.User, models.User.user_id == models.CuentaPagoConductor.driver_id)
    if estado != "TODAS":
        consulta = consulta.filter(models.CuentaPagoConductor.estado == estado)
    filas = consulta.order_by(models.CuentaPagoConductor.updated_at.desc()).limit(100).all()
    return [{
        **servicio.serializar_cuenta(cuenta, completa=True),
        "titular_documento": cuenta.titular_documento,
        "driver_id": conductor.user_id,
        "conductor_nombre": conductor.full_name,
        "conductor_email": conductor.email,
        "actualizada_at": cuenta.updated_at.isoformat() if cuenta.updated_at else None,
    } for cuenta, conductor in filas]


@router.post("/admin/cuentas/{cuenta_id}/verificar")
def verificar_cuenta(cuenta_id: int, payload: schemas.VerificarCuenta,
                     db: Session = Depends(get_db), admin: models.User = Depends(_solo_admin)):
    cuenta = db.get(models.CuentaPagoConductor, cuenta_id)
    if cuenta is None:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")
    if not payload.aprobar and not (payload.nota or "").strip():
        raise HTTPException(status_code=400, detail="Escribe por qué se rechaza, para que el conductor pueda corregirla.")

    cuenta.estado = "VERIFICADA" if payload.aprobar else "RECHAZADA"
    cuenta.nota_admin = (payload.nota or "").strip() or None
    cuenta.verificada_por = admin.user_id
    cuenta.verificada_at = servicio.ahora()
    db.commit()

    registrar_log(db, action="VERIFICAR_CUENTA_PAGOS", user_id=admin.user_id, entity="CuentaPagoConductor",
                  entity_id=cuenta.cuenta_id, detail=f"{cuenta.estado} (conductor #{cuenta.driver_id})")
    if payload.aprobar:
        servicio.notificar(db, cuenta.driver_id, "Tu cuenta de pagos fue verificada",
                           "Los pasajeros de tus viajes ya ven tu cuenta para pagarte.")
    else:
        servicio.notificar(db, cuenta.driver_id, "Revisa tu cuenta de pagos",
                           f"No pudimos verificarla: {cuenta.nota_admin}")
    return {"cuenta": servicio.serializar_cuenta(cuenta)}
