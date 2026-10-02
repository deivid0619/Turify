"""
ÉPICA 6 — Pagos (SCRUM-178): plan de pagos por etapas (SCRUM-258), código de
abordaje y etapas del viaje (SCRUM-259), doble confirmación (SCRUM-260),
comisión (SCRUM-261), ganancias (SCRUM-262), cuenta del conductor
(SCRUM-263), reclamos (SCRUM-264) y la nueva política de cancelación
(SCRUM-181).
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app import models
from app.pagos import reglas


# ── Ayudas ──────────────────────────────────────────────────────────────────

def _publicar(client, pasajero, auth_headers, *, ida_y_vuelta=False, horas=72, **extra):
    salida = datetime.now(timezone.utc) + timedelta(hours=horas)
    payload = {
        "origin": "Medellín, Antioquia",
        "destination": "Rionegro, Antioquia",
        "departure_time": salida.isoformat(),
        "trip_type": "ROUND_TRIP" if ida_y_vuelta else "ONE_WAY",
        "adults_count": 2,
        "children_count": 0,
        "has_pets": False,
        **extra,
    }
    if ida_y_vuelta:
        payload["return_time"] = (salida + timedelta(hours=8)).isoformat()
    respuesta = client.post("/api/service-requests/", json=payload, headers=auth_headers(pasajero))
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()["request_id"]


def _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, *,
                ida_y_vuelta=False, precio=500000, horas=72,
                email_pasajero="pagos.pasajero@example.com", email_conductor="pagos.conductor@example.com"):
    pasajero = crear_pasajero(email=email_pasajero)
    conductor, _vehiculo = crear_conductor_con_vehiculo(email=email_conductor)
    request_id = _publicar(client, pasajero, auth_headers, ida_y_vuelta=ida_y_vuelta, horas=horas)
    oferta = client.post(
        f"/api/service-requests/{request_id}/offers",
        json={"offered_price": precio}, headers=auth_headers(conductor),
    ).json()
    aceptada = client.patch(f"/api/service-requests/offers/{oferta['offer_id']}/accept", headers=auth_headers(pasajero))
    assert aceptada.status_code == 200, aceptada.text
    return pasajero, conductor, request_id


def _vista(client, usuario, auth_headers, request_id):
    respuesta = client.get(f"/api/pagos/viajes/{request_id}", headers=auth_headers(usuario))
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _pago(vista, hito):
    return next(p for p in vista["plan"]["pagos"] if p["hito"] == hito)


def _listo_para_iniciar(db_session, request_id):
    viaje = db_session.get(models.ServiceRequest, request_id)
    viaje.fuec_url = "https://fake.supabase.co/fuec.pdf"
    db_session.add(models.TripPassenger(
        request_id=request_id, full_name="Representante Del Viaje",
        document_type="CC", document_number="1009999999", es_representante=True,
    ))
    db_session.commit()


def _codigo(client, pasajero, auth_headers, request_id):
    return _vista(client, pasajero, auth_headers, request_id)["codigo_abordaje"]


def _iniciar(client, conductor, auth_headers, request_id, codigo):
    return client.patch(f"/api/service-requests/{request_id}/start",
                        json={"codigo": codigo}, headers=auth_headers(conductor))


def _pagar(client, pasajero, conductor, auth_headers, pago_id):
    """El pasajero reporta el pago y el conductor lo confirma."""
    assert client.post(f"/api/pagos/{pago_id}/reportar-pago", headers=auth_headers(pasajero)).status_code == 200
    assert client.post(f"/api/pagos/{pago_id}/confirmar-recibido", headers=auth_headers(conductor)).status_code == 200


def _codigo_equivocado(codigo):
    return "0000" if codigo != "0000" else "1111"


# ── Reglas puras ────────────────────────────────────────────────────────────

def test_reparto_suma_exacto_el_precio_aunque_haya_redondeo():
    reparto = reglas.repartir(Decimal("100001"), reglas.HITOS_IDA_Y_VUELTA)
    assert [m for _h, _p, m in reparto] == [Decimal("20000"), Decimal("50001"), Decimal("30000")]
    assert sum(m for _h, _p, m in reparto) == Decimal("100001")


def test_comision_solo_existe_si_el_anticipo_pasa_por_la_app(monkeypatch):
    monkeypatch.delenv("COMISION_TURIFY_PCT", raising=False)
    assert reglas.comision_vigente("DIRECTO") == (Decimal("0"), "SIN_PASARELA")
    assert reglas.comision_vigente("APP") == (Decimal("10"), "NORMAL")


def test_comision_configurable(monkeypatch):
    monkeypatch.setenv("COMISION_TURIFY_PCT", "8")
    assert reglas.comision_vigente("APP") == (Decimal("8"), "NORMAL")


def test_comision_nunca_supera_el_anticipo():
    assert reglas.calcular_comision(Decimal("500000"), Decimal("40"), tope=Decimal("150000")) == Decimal("150000")
    assert reglas.calcular_comision(Decimal("500000"), Decimal("10"), tope=Decimal("150000")) == Decimal("50000")


# ── Plan de pagos (SCRUM-258) ───────────────────────────────────────────────

def test_plan_ida_y_vuelta_es_20_50_30(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, _conductor, request_id = _confirmado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, ida_y_vuelta=True, precio=816100)

    plan = _vista(client, pasajero, auth_headers, request_id)["plan"]

    assert [(p["hito"], p["monto"]) for p in plan["pagos"]] == [
        ("ANTICIPO", 163220), ("LLEGADA_DESTINO", 408050), ("RECOGIDA_REGRESO", 244830)]
    assert plan["precio"] == 816100
    assert plan["comision"] == 0  # sin pasarela no hay de dónde descontarla
    anticipo = _pago({"plan": plan}, "ANTICIPO")
    assert anticipo["exigible"] is True
    assert anticipo["acciones"] == ["REPORTAR_PAGO"]
    assert _pago({"plan": plan}, "LLEGADA_DESTINO")["exigible"] is False


def test_plan_solo_ida_es_30_70(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, _conductor, request_id = _confirmado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, precio=573100)

    plan = _vista(client, pasajero, auth_headers, request_id)["plan"]

    assert [(p["hito"], p["monto"]) for p in plan["pagos"]] == [("ANTICIPO", 171930), ("LLEGADA_DESTINO", 401170)]


def test_contraoferta_aceptada_crea_el_plan_con_el_precio_final(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero = crear_pasajero(email="contra.pagos@example.com")
    conductor, _v = crear_conductor_con_vehiculo(email="contra.conductor@example.com")
    request_id = _publicar(client, pasajero, auth_headers)
    oferta = client.post(f"/api/service-requests/{request_id}/offers", json={"offered_price": 500000},
                         headers=auth_headers(conductor)).json()
    client.patch(f"/api/service-requests/offers/{oferta['offer_id']}/counter-offer",
                 json={"offered_price": 400000}, headers=auth_headers(pasajero))
    client.patch(f"/api/service-requests/offers/{oferta['offer_id']}/resolve",
                 json={"action": "ACCEPT"}, headers=auth_headers(conductor))

    plan = _vista(client, pasajero, auth_headers, request_id)["plan"]
    assert plan["precio"] == 400000
    assert _pago({"plan": plan}, "ANTICIPO")["monto"] == 120000


def test_precio_fijo_crea_el_plan(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero = crear_pasajero(email="fijo.pagos@example.com")
    conductor, _v = crear_conductor_con_vehiculo(email="fijo.conductor@example.com")
    request_id = _publicar(client, pasajero, auth_headers)
    # Precio fijo solo queda activo cuando hay precio sugerido calculado (con
    # la distancia de la ruta); acá se fija directo para no depender del motor.
    viaje = db_session.get(models.ServiceRequest, request_id)
    viaje.precio_fijo = True
    viaje.suggested_price = Decimal("300000")
    db_session.commit()

    assert client.post(f"/api/service-requests/{request_id}/accept-fixed-price",
                       headers=auth_headers(conductor)).status_code == 201

    plan = _vista(client, pasajero, auth_headers, request_id)["plan"]
    assert [p["monto"] for p in plan["pagos"]] == [90000, 210000]


# ── Código de abordaje y etapas (SCRUM-259) ─────────────────────────────────

def test_el_codigo_solo_lo_ve_el_pasajero(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)

    vista_pasajero = _vista(client, pasajero, auth_headers, request_id)
    vista_conductor = _vista(client, conductor, auth_headers, request_id)
    ofertas_conductor = client.get("/api/service-requests/driver/my-offers", headers=auth_headers(conductor)).json()

    assert len(vista_pasajero["codigo_abordaje"]) == 4 and vista_pasajero["codigo_abordaje"].isdigit()
    assert vista_pasajero["codigo_para"] == "IDA"
    assert "codigo_abordaje" not in vista_conductor
    assert all("codigo_abordaje" not in o for o in ofertas_conductor)


def test_iniciar_exige_el_codigo(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    _listo_para_iniciar(db_session, request_id)
    codigo = _codigo(client, pasajero, auth_headers, request_id)

    sin_codigo = client.patch(f"/api/service-requests/{request_id}/start", headers=auth_headers(conductor))
    equivocado = _iniciar(client, conductor, auth_headers, request_id, _codigo_equivocado(codigo))
    correcto = _iniciar(client, conductor, auth_headers, request_id, codigo)

    assert sin_codigo.status_code == 400
    assert equivocado.status_code == 400 and "quedan 4 intentos" in equivocado.json()["detail"]
    assert correcto.status_code == 200
    assert correcto.json()["tramo"] == "IDA"
    # Usado, ya no sirve ni se muestra.
    assert _codigo(client, pasajero, auth_headers, request_id) is None


def test_el_codigo_se_bloquea_tras_5_intentos(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    _listo_para_iniciar(db_session, request_id)
    codigo = _codigo(client, pasajero, auth_headers, request_id)

    respuestas = [_iniciar(client, conductor, auth_headers, request_id, _codigo_equivocado(codigo)) for _ in range(5)]
    con_el_correcto = _iniciar(client, conductor, auth_headers, request_id, codigo)

    assert [r.status_code for r in respuestas] == [400, 400, 400, 400, 429]
    assert con_el_correcto.status_code == 429  # bloqueado aunque ahora sí sea el código
    avisos = db_session.query(models.Notification).filter(models.Notification.user_id == pasajero.user_id).all()
    assert any("código de abordaje" in n.title for n in avisos)


def test_flujo_completo_ida_y_vuelta(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, ida_y_vuelta=True, precio=816100)
    _listo_para_iniciar(db_session, request_id)
    _pagar(client, pasajero, conductor, auth_headers, _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"])

    assert _iniciar(client, conductor, auth_headers, request_id, _codigo(client, pasajero, auth_headers, request_id)).status_code == 200
    assert client.patch(f"/api/service-requests/{request_id}/complete", headers=auth_headers(conductor)).status_code == 400

    llegada = client.patch(f"/api/service-requests/{request_id}/arrive", headers=auth_headers(conductor))
    assert llegada.status_code == 200 and llegada.json()["tramo"] == "EN_DESTINO"
    vista = _vista(client, pasajero, auth_headers, request_id)
    assert vista["codigo_para"] == "REGRESO" and vista["codigo_abordaje"]
    assert _pago(vista, "LLEGADA_DESTINO")["exigible"] is True
    assert _pago(vista, "RECOGIDA_REGRESO")["exigible"] is False
    _pagar(client, pasajero, conductor, auth_headers, _pago(vista, "LLEGADA_DESTINO")["pago_id"])

    regreso = client.patch(f"/api/service-requests/{request_id}/start-return",
                           json={"codigo": vista["codigo_abordaje"]}, headers=auth_headers(conductor))
    assert regreso.status_code == 200 and regreso.json()["tramo"] == "REGRESO"

    # El conductor también puede confirmar sin que el pasajero haya reportado antes.
    pago_regreso = _pago(_vista(client, conductor, auth_headers, request_id), "RECOGIDA_REGRESO")
    assert "CONFIRMAR_RECIBIDO" in pago_regreso["acciones"]
    assert client.post(f"/api/pagos/{pago_regreso['pago_id']}/confirmar-recibido",
                       headers=auth_headers(conductor)).status_code == 200

    final = client.patch(f"/api/service-requests/{request_id}/complete", headers=auth_headers(conductor))
    assert final.status_code == 200
    vista_final = _vista(client, pasajero, auth_headers, request_id)
    assert vista_final["plan"]["pagado"] == 816100 and vista_final["plan"]["por_pagar"] == 0
    tipos = [e["tipo"] for e in vista_final["bitacora"]]
    for tipo in ("VIAJE_CONFIRMADO", "ABORDAJE_IDA", "LLEGADA_DESTINO", "ABORDAJE_REGRESO", "VIAJE_FINALIZADO"):
        assert tipo in tipos


def test_solo_ida_el_70_se_debe_al_finalizar(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    _listo_para_iniciar(db_session, request_id)
    _iniciar(client, conductor, auth_headers, request_id, _codigo(client, pasajero, auth_headers, request_id))

    assert client.patch(f"/api/service-requests/{request_id}/arrive", headers=auth_headers(conductor)).status_code == 400
    assert client.patch(f"/api/service-requests/{request_id}/complete", headers=auth_headers(conductor)).status_code == 200

    llegada = _pago(_vista(client, pasajero, auth_headers, request_id), "LLEGADA_DESTINO")
    assert llegada["exigible"] is True and llegada["acciones"] == ["REPORTAR_PAGO"]


def test_cerrar_sin_regreso_anula_el_pago_del_regreso(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, ida_y_vuelta=True)
    _listo_para_iniciar(db_session, request_id)
    _iniciar(client, conductor, auth_headers, request_id, _codigo(client, pasajero, auth_headers, request_id))
    client.patch(f"/api/service-requests/{request_id}/arrive", headers=auth_headers(conductor))

    sin_motivo = client.patch(f"/api/service-requests/{request_id}/close-without-return",
                              json={"motivo": ""}, headers=auth_headers(conductor))
    cerrado = client.patch(f"/api/service-requests/{request_id}/close-without-return",
                           json={"motivo": "El grupo decidió quedarse el fin de semana."}, headers=auth_headers(conductor))

    assert sin_motivo.status_code == 422
    assert cerrado.status_code == 200 and cerrado.json()["status"] == "COMPLETED"
    vista = _vista(client, pasajero, auth_headers, request_id)
    assert vista["cerrado_sin_regreso"] is True
    assert _pago(vista, "RECOGIDA_REGRESO")["estado"] == "ANULADO"

    reclamo = client.post(f"/api/pagos/viajes/{request_id}/reclamos",
                          json={"motivo": "El conductor no volvió por nosotros."}, headers=auth_headers(pasajero))
    assert reclamo.status_code == 201
    assert reclamo.json()["reclamos"][0]["estado"] == "ABIERTO"


# ── Doble confirmación y reclamos (SCRUM-260 / SCRUM-264) ───────────────────

def test_solo_quien_recibe_la_plata_la_confirma(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    intruso = crear_pasajero(email="intruso.pagos@example.com")
    pago_id = _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"]

    assert client.post(f"/api/pagos/{pago_id}/reportar-pago", headers=auth_headers(intruso)).status_code == 403
    assert client.post(f"/api/pagos/{pago_id}/reportar-pago", headers=auth_headers(conductor)).status_code == 403
    assert client.post(f"/api/pagos/{pago_id}/confirmar-recibido", headers=auth_headers(pasajero)).status_code == 403
    assert client.get(f"/api/pagos/viajes/{request_id}", headers=auth_headers(intruso)).status_code == 403

    reportado = client.post(f"/api/pagos/{pago_id}/reportar-pago", headers=auth_headers(pasajero))
    assert _pago(reportado.json(), "ANTICIPO")["estado"] == "PAGO_REPORTADO"
    # No se puede reportar dos veces.
    assert client.post(f"/api/pagos/{pago_id}/reportar-pago", headers=auth_headers(pasajero)).status_code == 400


def test_pago_no_recibido_abre_reclamo_que_resuelve_el_admin(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    admin = crear_pasajero(email="admin.pagos@example.com", role="ADMIN")
    pago_id = _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"]
    client.post(f"/api/pagos/{pago_id}/reportar-pago", headers=auth_headers(pasajero))

    no_recibido = client.post(f"/api/pagos/{pago_id}/no-recibido", headers=auth_headers(conductor))
    assert no_recibido.status_code == 200
    assert _pago(no_recibido.json(), "ANTICIPO")["estado"] == "EN_RECLAMO"

    assert client.get("/api/pagos/admin/reclamos", headers=auth_headers(pasajero)).status_code == 403
    reclamos = client.get("/api/pagos/admin/reclamos", headers=auth_headers(admin)).json()
    assert len(reclamos) == 1 and reclamos[0]["pago_estado_previo"] == "PAGO_REPORTADO"
    assert any(e["tipo"] == "PAGO_NO_RECIBIDO" for e in reclamos[0]["bitacora"])

    resuelto = client.post(f"/api/pagos/admin/reclamos/{reclamos[0]['reclamo_id']}/resolver",
                           json={"decision": "PAGO_CONFIRMADO", "nota": "El pasajero mostró el comprobante de Nequi."},
                           headers=auth_headers(admin))
    assert resuelto.status_code == 200 and resuelto.json()["pago_estado"] == "CONFIRMADO"
    assert _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["estado"] == "CONFIRMADO"


def test_reclamo_sin_cambios_devuelve_el_pago_a_como_estaba(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    admin = crear_pasajero(email="admin.sincambios@example.com", role="ADMIN")
    pago_id = _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"]
    client.post(f"/api/pagos/{pago_id}/reportar-pago", headers=auth_headers(pasajero))
    client.post(f"/api/pagos/{pago_id}/no-recibido", headers=auth_headers(conductor))
    reclamo_id = client.get("/api/pagos/admin/reclamos", headers=auth_headers(admin)).json()[0]["reclamo_id"]

    resuelto = client.post(f"/api/pagos/admin/reclamos/{reclamo_id}/resolver",
                           json={"decision": "SIN_CAMBIOS", "nota": "Lo resuelven entre ellos; ya hablamos con los dos."},
                           headers=auth_headers(admin))

    # No se queda "en reclamo" para siempre: el conductor puede volver a confirmarlo.
    assert resuelto.json()["pago_estado"] == "PAGO_REPORTADO"
    assert _pago(_vista(client, conductor, auth_headers, request_id), "ANTICIPO")["acciones"][0] == "CONFIRMAR_RECIBIDO"


# ── Cancelación: el anticipo es la penalización (SCRUM-181) ─────────────────

def test_cancelar_con_24h_o_mas_devuelve_el_anticipo(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=72)
    pago_id = _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"]
    _pagar(client, pasajero, conductor, auth_headers, pago_id)

    cancelado = client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(pasajero)).json()

    assert cancelado["penalty_amount"] == 0 and cancelado["monto_a_devolver"] == 150000
    pendientes_conductor = client.get("/api/pagos/pendientes", headers=auth_headers(conductor)).json()
    assert [p["pago"]["acciones"] for p in pendientes_conductor] == [["REPORTAR_DEVOLUCION"]]

    client.post(f"/api/pagos/{pago_id}/reportar-devolucion", headers=auth_headers(conductor))
    pendientes_pasajero = client.get("/api/pagos/pendientes", headers=auth_headers(pasajero)).json()
    assert pendientes_pasajero[0]["pago"]["acciones"] == ["CONFIRMAR_DEVOLUCION", "DEVOLUCION_NO_RECIBIDA"]
    devuelto = client.post(f"/api/pagos/{pago_id}/confirmar-devolucion", headers=auth_headers(pasajero))
    assert devuelto.status_code == 200
    assert client.get("/api/pagos/pendientes", headers=auth_headers(pasajero)).json() == []


def test_cancelar_con_menos_de_24h_pierde_el_anticipo_pagado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=10)
    pago_id = _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"]
    _pagar(client, pasajero, conductor, auth_headers, pago_id)

    cancelado = client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(pasajero)).json()

    assert cancelado["penalty_percentage"] == 30 and cancelado["penalty_amount"] == 150000
    assert cancelado["monto_a_devolver"] == 0
    plan = _vista(client, conductor, auth_headers, request_id)["plan"]
    assert _pago({"plan": plan}, "ANTICIPO")["estado"] == "CONFIRMADO"  # se queda con el conductor
    assert _pago({"plan": plan}, "LLEGADA_DESTINO")["estado"] == "ANULADO"


def test_cancelar_con_menos_de_24h_sin_anticipo_pagado_no_penaliza(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=10)

    cancelado = client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(pasajero)).json()

    assert cancelado["penalty_amount"] == 0 and cancelado["anticipo_pagado"] is False
    assert _pago(_vista(client, conductor, auth_headers, request_id), "ANTICIPO")["estado"] == "ANULADO"


def test_conductor_que_cancela_sin_anticipo_pagado_no_pierde_confiabilidad(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    _pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)

    cancelado = client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(conductor))

    assert cancelado.status_code == 200 and cancelado.json()["status"] == "PENDING"
    db_session.refresh(conductor)
    assert conductor.cancelaciones_injustificadas == 0


def test_conductor_que_cancela_con_anticipo_pagado_debe_devolverlo(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    pago_id = _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"]
    _pagar(client, pasajero, conductor, auth_headers, pago_id)

    cancelado = client.patch(f"/api/service-requests/{request_id}/cancel", headers=auth_headers(conductor)).json()

    assert cancelado["monto_a_devolver"] == 150000
    db_session.refresh(conductor)
    assert conductor.cancelaciones_injustificadas == 1
    # El viaje vuelve a buscar conductor; la devolución sigue a la vista del pasajero.
    pendientes = client.get("/api/pagos/pendientes", headers=auth_headers(pasajero)).json()
    assert pendientes[0]["pago"]["estado"] == "DEVOLUCION_PENDIENTE"

    # Otro conductor toma el viaje: plan nuevo, y la devolución vieja sigue visible.
    otro, _v = crear_conductor_con_vehiculo(email="otro.conductor.pagos@example.com")
    oferta = client.post(f"/api/service-requests/{request_id}/offers", json={"offered_price": 520000},
                         headers=auth_headers(otro)).json()
    client.patch(f"/api/service-requests/offers/{oferta['offer_id']}/accept", headers=auth_headers(pasajero))
    plan = _vista(client, pasajero, auth_headers, request_id)["plan"]
    assert plan["precio"] == 520000
    assert [p["estado"] for p in plan["devoluciones_de_otros_conductores"]] == ["DEVOLUCION_PENDIENTE"]
    # Y el conductor que canceló todavía ve lo que tiene que devolver.
    viejo = _vista(client, conductor, auth_headers, request_id)["plan"]
    assert _pago({"plan": viejo}, "ANTICIPO")["acciones"] == ["REPORTAR_DEVOLUCION"]


# ── Cuenta del conductor (SCRUM-263) ────────────────────────────────────────

def test_cuenta_a_nombre_del_conductor_verificada_por_el_admin(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    admin = crear_pasajero(email="admin.cuentas@example.com", role="ADMIN")
    for lado in ("Cedula frente", "Cedula reverso"):
        db_session.add(models.Document(user_id=conductor.user_id, document_type=lado,
                                       file_url=f"https://ejemplo.supabase.co/{lado}.jpg"))
    db_session.commit()
    cuenta = {"tipo": "NEQUI", "numero": "3001234567", "titular_documento": "1023456789"}

    ajena = client.put("/api/pagos/cuenta", json={**cuenta, "titular_nombre": "Pedro Picapiedra"}, headers=auth_headers(conductor))
    propia = client.put("/api/pagos/cuenta", json={**cuenta, "titular_nombre": "Conductor Gómez de Prueba"}, headers=auth_headers(conductor))

    assert ajena.status_code == 400
    assert propia.status_code == 200 and propia.json()["cuenta"]["estado"] == "PENDIENTE_VERIFICACION"
    assert _vista(client, pasajero, auth_headers, request_id)["cuenta_conductor"] is None  # aún sin verificar

    pendientes = client.get("/api/pagos/admin/cuentas", headers=auth_headers(admin)).json()
    # El admin ve la cédula del conductor para compararla con el titular.
    assert [d["document_type"] for d in pendientes[0]["cedula"]] == ["Cedula frente", "Cedula reverso"]
    client.post(f"/api/pagos/admin/cuentas/{pendientes[0]['cuenta_id']}/verificar",
                json={"aprobar": True}, headers=auth_headers(admin))
    assert _vista(client, pasajero, auth_headers, request_id)["cuenta_conductor"]["numero"] == "3001234567"

    # Cambiarla la vuelve a dejar en revisión (y deja de mostrarse).
    cambio = client.put("/api/pagos/cuenta", json={**cuenta, "numero": "3009998877", "titular_nombre": "Conductor de Prueba"},
                        headers=auth_headers(conductor))
    assert cambio.json()["cuenta"]["estado"] == "PENDIENTE_VERIFICACION"
    assert _vista(client, pasajero, auth_headers, request_id)["cuenta_conductor"] is None


def test_cuenta_nequi_valida_el_celular(client, crear_conductor_con_vehiculo, auth_headers):
    conductor, _v = crear_conductor_con_vehiculo(email="nequi.conductor@example.com")
    respuesta = client.put("/api/pagos/cuenta", json={
        "tipo": "NEQUI", "numero": "12345", "titular_nombre": "Conductor de Prueba", "titular_documento": "1023456"},
        headers=auth_headers(conductor))
    assert respuesta.status_code == 422


# ── Ganancias (SCRUM-262) ───────────────────────────────────────────────────

def test_ganancias_muestran_lo_recibido_y_lo_que_se_debe(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session):
    pasajero, conductor, request_id = _confirmado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    _listo_para_iniciar(db_session, request_id)
    _pagar(client, pasajero, conductor, auth_headers, _pago(_vista(client, pasajero, auth_headers, request_id), "ANTICIPO")["pago_id"])
    _iniciar(client, conductor, auth_headers, request_id, _codigo(client, pasajero, auth_headers, request_id))
    client.patch(f"/api/service-requests/{request_id}/complete", headers=auth_headers(conductor))

    ganancias = client.get("/drivers/earnings", headers=auth_headers(conductor)).json()

    assert ganancias["recibido_mes"] == 150000
    assert ganancias["por_cobrar"] == 350000  # el 70 % al dejarlos, todavía sin confirmar
    assert ganancias["comision_mes"] == 0
    assert ganancias["viajes_pagos"][0]["neto"] == 500000
