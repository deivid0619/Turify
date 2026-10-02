"""
SCRUM-179/180 — anticipo pagado en la app con Wompi: link de pago firmado,
confirmación al volver de Wompi y por el webhook firmado, anticipo retenido
por Turify hasta la llegada, entrega al conductor (menos la comisión) y
reembolsos al pasajero. Wompi no se llama de verdad: la consulta de la
transacción se reemplaza y los eventos se firman con un secreto de prueba.
"""
import hashlib
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app import models
from app.pagos import wompi
from tests.test_pagos import _codigo, _confirmado, _iniciar, _listo_para_iniciar, _pago, _vista

SECRETO_INTEGRIDAD = "test_integrity_prueba"
SECRETO_EVENTOS = "test_events_prueba"


@pytest.fixture()
def con_wompi(monkeypatch):
    """Llaves de sandbox en el entorno y una 'API de Wompi' en memoria."""
    monkeypatch.setenv("WOMPI_PUBLIC_KEY", "pub_test_prueba")
    monkeypatch.setenv("WOMPI_INTEGRITY_SECRET", SECRETO_INTEGRIDAD)
    monkeypatch.setenv("WOMPI_EVENTS_SECRET", SECRETO_EVENTOS)
    monkeypatch.setenv("FRONTEND_URL", "https://turify.test/")
    monkeypatch.delenv("COMISION_TURIFY_PCT", raising=False)
    transacciones = {}
    monkeypatch.setattr(wompi, "consultar_transaccion", lambda transaccion_id: transacciones[transaccion_id])
    return transacciones


def _transaccion(referencia, monto, estado="APPROVED", id_="12345-1700000000-11111", metodo="NEQUI"):
    return {"id": id_, "reference": referencia, "amount_in_cents": monto * 100, "currency": "COP",
            "status": estado, "payment_method_type": metodo}


def _evento(transaccion, secreto=SECRETO_EVENTOS, timestamp=1700000000):
    cadena = f"{transaccion['id']}{transaccion['status']}{transaccion['amount_in_cents']}{timestamp}{secreto}"
    return {
        "event": "transaction.updated",
        "data": {"transaction": transaccion},
        "environment": "test",
        "signature": {"properties": ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
                      "checksum": hashlib.sha256(cadena.encode()).hexdigest().upper()},
        "timestamp": timestamp,
        "sent_at": "2026-10-02T15:00:00.000Z",
    }


def _anticipo(client, pasajero, auth_headers, request_id):
    return _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")


def _abrir_checkout(client, pasajero, auth_headers, pago_id):
    respuesta = client.post(f"/api/pagos/{pago_id}/pagar-en-linea", headers=auth_headers(pasajero))
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _pagar_en_linea(client, pasajero, auth_headers, request_id, transacciones, id_="12345-1700000000-11111"):
    """El pasajero abre el checkout, paga y vuelve a Turify con ?id=…"""
    anticipo = _anticipo(client, pasajero, auth_headers, request_id)
    checkout = _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])
    transacciones[id_] = _transaccion(checkout["referencia"], anticipo["monto"], id_=id_)
    respuesta = client.post("/api/pagos/wompi/confirmar", json={"transaccion_id": id_}, headers=auth_headers(pasajero))
    assert respuesta.status_code == 200, respuesta.text
    return anticipo, checkout


def _cuenta_verificada(db_session, conductor):
    db_session.add(models.CuentaPagoConductor(
        driver_id=conductor.user_id, tipo="NEQUI", numero="3001234567",
        titular_nombre=conductor.full_name, titular_documento="1023456789", estado="VERIFICADA",
    ))
    db_session.commit()


def _estado(db_session, pago_id):
    """Estado del pago leído en la base (el pasajero deja de ver el plan de
    un viaje cancelado salvo lo que esté por devolverse)."""
    db_session.expire_all()
    return db_session.get(models.PagoViaje, pago_id).estado


def _tipos_bitacora(client, usuario, auth_headers, request_id):
    return [e["tipo"] for e in _vista(client, usuario, auth_headers, request_id)["bitacora"]]


# ── Canal del anticipo ──────────────────────────────────────────────────────

def test_sin_llaves_de_wompi_el_anticipo_se_paga_directo(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                         auth_headers, monkeypatch):
    for llave in ("WOMPI_PUBLIC_KEY", "WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET"):
        monkeypatch.delenv(llave, raising=False)
    pasajero, _c, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)

    anticipo = _anticipo(client, pasajero, auth_headers, request_id)

    assert anticipo["canal"] == "DIRECTO" and anticipo["comision"] == 0
    assert anticipo["acciones"] == ["REPORTAR_PAGO"]
    assert client.post(f"/api/pagos/{anticipo['pago_id']}/pagar-en-linea",
                       headers=auth_headers(pasajero)).status_code == 503


def test_con_llaves_el_anticipo_se_paga_en_la_app_con_comision(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                               auth_headers, con_wompi):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)

    anticipo = _anticipo(client, pasajero, auth_headers, request_id)
    del_conductor = _anticipo(client, conductor, auth_headers, request_id)

    assert anticipo["canal"] == "APP" and anticipo["monto"] == 150000
    assert anticipo["comision"] == 50000  # 10 % de $500.000, descontado del anticipo
    assert anticipo["acciones"] == ["PAGAR_EN_LINEA"]
    assert anticipo["estado_texto"] == "Por pagar en la app"
    assert del_conductor["acciones"] == []  # no hay nada que confirmar: lo confirma Wompi


def test_link_de_pago_lleva_monto_y_referencia_firmados(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                        auth_headers, con_wompi):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    anticipo = _anticipo(client, pasajero, auth_headers, request_id)

    checkout = _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])
    url = urlparse(checkout["url"])
    q = {k: v[0] for k, v in parse_qs(url.query).items()}

    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://checkout.wompi.co/p/"
    assert checkout["ambiente"] == "sandbox"
    assert q["public-key"] == "pub_test_prueba" and q["currency"] == "COP"
    assert q["amount-in-cents"] == "15000000"
    assert wompi.leer_referencia(q["reference"]) == (request_id, anticipo["pago_id"])
    assert q["redirect-url"] == "https://turify.test/dashboard?pago=wompi"
    esperado = hashlib.sha256(
        f"{q['reference']}15000000COP{q['expiration-time']}{SECRETO_INTEGRIDAD}".encode()).hexdigest()
    assert q["signature:integrity"] == esperado
    # Cada intento tiene su propia referencia (Wompi no admite repetirla).
    assert _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])["referencia"] != checkout["referencia"]
    # Solo el pasajero del viaje puede abrir el pago.
    assert client.post(f"/api/pagos/{anticipo['pago_id']}/pagar-en-linea",
                       headers=auth_headers(conductor)).status_code == 403


# ── Resultado del pago ──────────────────────────────────────────────────────

def test_al_volver_de_wompi_el_anticipo_queda_retenido_una_sola_vez(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                                    auth_headers, con_wompi):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)

    anticipo, _checkout = _pagar_en_linea(client, pasajero, auth_headers, request_id, con_wompi)
    otra_vez = client.post("/api/pagos/wompi/confirmar", json={"transaccion_id": "12345-1700000000-11111"},
                           headers=auth_headers(pasajero))

    assert otra_vez.status_code == 200 and otra_vez.json()["pago_estado"] == "RETENIDO"
    vista = _vista(client, pasajero, auth_headers, request_id)
    assert _pago(vista, "ANTICIPO")["estado"] == "RETENIDO"
    assert _pago(vista, "ANTICIPO")["acciones"] == []
    assert vista["plan"]["pagado"] == 150000
    assert _tipos_bitacora(client, pasajero, auth_headers, request_id).count("PAGO_EN_LINEA_APROBADO") == 1
    aprobado = next(e for e in vista["bitacora"] if e["tipo"] == "PAGO_EN_LINEA_APROBADO")
    assert aprobado["quien"] == "Turify" and aprobado["detalle"].startswith("Wompi 12345-1700000000-11111 · Nequi:")
    # Otro pasajero no puede "confirmar" una transacción ajena.
    intruso = crear_pasajero(email="intruso.wompi@example.com")
    assert client.post("/api/pagos/wompi/confirmar", json={"transaccion_id": "12345-1700000000-11111"},
                       headers=auth_headers(intruso)).status_code == 403


def test_webhook_firmado_marca_el_pago_y_rechaza_firmas_falsas(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                               auth_headers, con_wompi):
    pasajero, _c, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    anticipo = _anticipo(client, pasajero, auth_headers, request_id)
    checkout = _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])
    transaccion = _transaccion(checkout["referencia"], anticipo["monto"])

    falso = client.post("/api/pagos/wompi/eventos", json=_evento(transaccion, secreto="otro_secreto"))
    assert falso.status_code == 401
    assert _anticipo(client, pasajero, auth_headers, request_id)["estado"] == "PENDIENTE"

    real = client.post("/api/pagos/wompi/eventos", json=_evento(transaccion))
    repetido = client.post("/api/pagos/wompi/eventos", json=_evento(transaccion))

    assert real.status_code == 200 and repetido.status_code == 200
    assert _anticipo(client, pasajero, auth_headers, request_id)["estado"] == "RETENIDO"
    assert _tipos_bitacora(client, pasajero, auth_headers, request_id).count("PAGO_EN_LINEA_APROBADO") == 1


def test_pago_rechazado_deja_el_anticipo_por_pagar(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                   auth_headers, con_wompi):
    pasajero, _c, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    anticipo = _anticipo(client, pasajero, auth_headers, request_id)
    checkout = _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])
    con_wompi["999-1-1"] = _transaccion(checkout["referencia"], anticipo["monto"], estado="DECLINED", id_="999-1-1")

    respuesta = client.post("/api/pagos/wompi/confirmar", json={"transaccion_id": "999-1-1"}, headers=auth_headers(pasajero))

    assert respuesta.json()["estado_transaccion"] == "DECLINED"
    despues = _anticipo(client, pasajero, auth_headers, request_id)
    assert despues["estado"] == "PENDIENTE" and despues["acciones"] == ["PAGAR_EN_LINEA"]
    assert "PAGO_EN_LINEA_RECHAZADO" in _tipos_bitacora(client, pasajero, auth_headers, request_id)


def test_transaccion_con_otro_monto_no_toca_el_pago(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                    auth_headers, con_wompi):
    pasajero, _c, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    anticipo = _anticipo(client, pasajero, auth_headers, request_id)
    checkout = _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])
    con_wompi["5-5-5"] = _transaccion(checkout["referencia"], 1000, id_="5-5-5")

    client.post("/api/pagos/wompi/confirmar", json={"transaccion_id": "5-5-5"}, headers=auth_headers(pasajero))

    assert _anticipo(client, pasajero, auth_headers, request_id)["estado"] == "PENDIENTE"


def test_si_wompi_no_responde_se_avisa_sin_tocar_el_pago(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                          auth_headers, con_wompi, monkeypatch):
    pasajero, _c, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)

    def _caido(_id):
        raise httpx.ConnectError("sin conexión")
    monkeypatch.setattr(wompi, "consultar_transaccion", _caido)

    respuesta = client.post("/api/pagos/wompi/confirmar", json={"transaccion_id": "1-2-3"}, headers=auth_headers(pasajero))

    assert respuesta.status_code == 502
    assert _anticipo(client, pasajero, auth_headers, request_id)["estado"] == "PENDIENTE"


def test_cobro_doble_abre_un_reclamo_para_reembolsar(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                     auth_headers, con_wompi):
    pasajero, _c, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    admin = crear_pasajero(email="admin.doble@example.com", role="ADMIN")
    anticipo = _anticipo(client, pasajero, auth_headers, request_id)
    # Abrió el pago en dos pestañas y pagó en las dos.
    for id_ in ("1-1-1", "2-2-2"):
        checkout = _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])
        con_wompi[id_] = _transaccion(checkout["referencia"], anticipo["monto"], id_=id_)
    for id_ in ("1-1-1", "2-2-2"):
        client.post("/api/pagos/wompi/confirmar", json={"transaccion_id": id_}, headers=auth_headers(pasajero))

    assert _anticipo(client, pasajero, auth_headers, request_id)["estado"] == "RETENIDO"
    reclamos = client.get("/api/pagos/admin/reclamos", headers=auth_headers(admin)).json()
    assert len(reclamos) == 1 and reclamos[0]["abierto_por_rol"] == "Turify"
    assert "2-2-2" in reclamos[0]["motivo"]


# ── Entrega al conductor ────────────────────────────────────────────────────

def test_el_admin_entrega_el_anticipo_al_llegar_menos_la_comision(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                                  auth_headers, con_wompi, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers,
                                                  ida_y_vuelta=True)
    admin = crear_pasajero(email="admin.anticipos@example.com", role="ADMIN")
    anticipo, _checkout = _pagar_en_linea(client, pasajero, auth_headers, request_id, con_wompi)
    pago_id = anticipo["pago_id"]  # 20 % de $500.000 = $100.000; comisión $50.000

    ganancias = client.get("/drivers/earnings", headers=auth_headers(conductor)).json()
    assert ganancias["por_cobrar"] == 50000  # el neto del anticipo retenido

    listado = client.get("/api/pagos/admin/anticipos", headers=auth_headers(admin)).json()
    assert [f["pago"]["pago_id"] for f in listado["retenidos"]] == [pago_id]
    assert listado["retenidos"][0]["motivo"] == "Se entrega cuando lleguen al destino."
    assert listado["retenidos"][0]["wompi"] == {"transaccion_id": "12345-1700000000-11111", "medio": "Nequi"}
    assert client.post(f"/api/pagos/admin/anticipos/{pago_id}/liberar", headers=auth_headers(admin)).status_code == 400

    _listo_para_iniciar(db_session, request_id)
    assert _iniciar(client, conductor, auth_headers, request_id, _codigo(client, pasajero, auth_headers, request_id)).status_code == 200
    assert client.patch(f"/api/service-requests/{request_id}/arrive", headers=auth_headers(conductor)).status_code == 200

    listado = client.get("/api/pagos/admin/anticipos", headers=auth_headers(admin)).json()
    assert [f["pago"]["pago_id"] for f in listado["por_liberar"]] == [pago_id]
    assert listado["por_liberar"][0]["cuenta_conductor"] is None
    sin_cuenta = client.post(f"/api/pagos/admin/anticipos/{pago_id}/liberar", headers=auth_headers(admin))
    assert sin_cuenta.status_code == 400 and "cuenta" in sin_cuenta.json()["detail"]

    _cuenta_verificada(db_session, conductor)
    assert client.post(f"/api/pagos/admin/anticipos/{pago_id}/liberar", headers=auth_headers(pasajero)).status_code == 403
    liberado = client.post(f"/api/pagos/admin/anticipos/{pago_id}/liberar",
                           json={"nota": "Transferencia Nequi #8812"}, headers=auth_headers(admin))

    assert liberado.status_code == 200 and liberado.json()["neto_conductor"] == 50000
    assert _anticipo(client, conductor, auth_headers, request_id)["estado_texto"] == "Turify te lo transfirió"
    ganancias = client.get("/drivers/earnings", headers=auth_headers(conductor)).json()
    assert ganancias["recibido_mes"] == 50000 and ganancias["comision_mes"] == 50000
    assert "ANTICIPO_LIBERADO" in _tipos_bitacora(client, conductor, auth_headers, request_id)


def test_un_reclamo_abierto_congela_el_anticipo(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                auth_headers, con_wompi, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    admin = crear_pasajero(email="admin.congela@example.com", role="ADMIN")
    anticipo, _checkout = _pagar_en_linea(client, pasajero, auth_headers, request_id, con_wompi)
    _cuenta_verificada(db_session, conductor)
    _listo_para_iniciar(db_session, request_id)
    _iniciar(client, conductor, auth_headers, request_id, _codigo(client, pasajero, auth_headers, request_id))
    assert client.patch(f"/api/service-requests/{request_id}/complete", headers=auth_headers(conductor)).status_code == 200

    client.post(f"/api/pagos/viajes/{request_id}/reclamos", json={"motivo": "El carro no era el acordado."},
                headers=auth_headers(pasajero))
    congelado = client.post(f"/api/pagos/admin/anticipos/{anticipo['pago_id']}/liberar", headers=auth_headers(admin))

    assert congelado.status_code == 400 and "reclamo" in congelado.json()["detail"]


# ── Cancelaciones y reembolsos ──────────────────────────────────────────────

def test_cancelar_con_tiempo_turify_reembolsa_el_anticipo(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                           auth_headers, con_wompi):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=72)
    admin = crear_pasajero(email="admin.reembolso@example.com", role="ADMIN")
    anticipo, _checkout = _pagar_en_linea(client, pasajero, auth_headers, request_id, con_wompi)

    cancelado = client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(pasajero)).json()

    assert cancelado["penalty_amount"] == 0 and cancelado["reembolso_turify"] == 150000
    del_pasajero = client.get("/api/pagos/pendientes", headers=auth_headers(pasajero)).json()
    assert del_pasajero[0]["pago"]["estado_texto"] == "Turify te lo devuelve"
    assert del_pasajero[0]["pago"]["acciones"] == []
    assert client.get("/api/pagos/pendientes", headers=auth_headers(conductor)).json() == []  # no le toca devolver
    assert client.get("/drivers/earnings", headers=auth_headers(conductor)).json()["por_devolver"] == 0

    listado = client.get("/api/pagos/admin/anticipos", headers=auth_headers(admin)).json()
    assert [f["pago"]["pago_id"] for f in listado["por_reembolsar"]] == [anticipo["pago_id"]]
    hecho = client.post(f"/api/pagos/admin/anticipos/{anticipo['pago_id']}/reembolsar", headers=auth_headers(admin))

    assert hecho.status_code == 200 and hecho.json()["estado"] == "REEMBOLSADO"
    assert client.get("/api/pagos/pendientes", headers=auth_headers(pasajero)).json() == []


def test_cancelar_tarde_el_anticipo_es_la_compensacion_del_conductor(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                                    auth_headers, con_wompi, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=10)
    admin = crear_pasajero(email="admin.compensa@example.com", role="ADMIN")
    anticipo, _checkout = _pagar_en_linea(client, pasajero, auth_headers, request_id, con_wompi)
    _cuenta_verificada(db_session, conductor)

    cancelado = client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(pasajero)).json()

    assert cancelado["penalty_amount"] == 150000 and cancelado["reembolso_turify"] == 0
    listado = client.get("/api/pagos/admin/anticipos", headers=auth_headers(admin)).json()
    assert [f["pago"]["pago_id"] for f in listado["por_liberar"]] == [anticipo["pago_id"]]
    liberado = client.post(f"/api/pagos/admin/anticipos/{anticipo['pago_id']}/liberar", headers=auth_headers(admin))
    assert liberado.json()["neto_conductor"] == 150000  # sin comisión: es la penalización entera


def test_pagar_cuando_el_viaje_ya_se_cancelo_se_reembolsa(client, crear_pasajero, crear_conductor_con_vehiculo,
                                                          auth_headers, con_wompi, db_session):
    pasajero, _c, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    anticipo = _anticipo(client, pasajero, auth_headers, request_id)
    checkout = _abrir_checkout(client, pasajero, auth_headers, anticipo["pago_id"])
    client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(pasajero))
    assert _estado(db_session, anticipo["pago_id"]) == "ANULADO"

    transaccion = _transaccion(checkout["referencia"], anticipo["monto"], id_="7-7-7")
    client.post("/api/pagos/wompi/eventos", json=_evento(transaccion))

    assert _estado(db_session, anticipo["pago_id"]) == "DEVOLUCION_PENDIENTE"
    assert "PAGO_EN_LINEA_TARDIO" in _tipos_bitacora(client, pasajero, auth_headers, request_id)

    # Si el admin la anula en el panel de Wompi, el evento la deja reembolsada.
    client.post("/api/pagos/wompi/eventos", json=_evento({**transaccion, "status": "VOIDED"}))
    assert _estado(db_session, anticipo["pago_id"]) == "REEMBOLSADO"


# ── Firma de los eventos ────────────────────────────────────────────────────

def test_la_firma_del_evento_no_depende_de_mayusculas(con_wompi):
    evento = _evento(_transaccion("TFY000001-P1-0123abcd", 1000))
    assert wompi.evento_autentico(evento)
    evento["signature"]["checksum"] = evento["signature"]["checksum"].lower()
    assert wompi.evento_autentico(evento)
    evento["timestamp"] = 1700000001
    assert not wompi.evento_autentico(evento)
    assert not wompi.evento_autentico({"data": {}, "signature": {}})
