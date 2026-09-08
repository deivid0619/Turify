"""
SCRUM-193 (HU45) — Tests adicionales sobre negociación de ofertas y ciclo de
vida del viaje, para acercar la cobertura de app/routers/service_requests.py
a la meta del 70% (los 5 flujos mínimos pedidos por el ticket ya están en
test_auth.py y test_service_requests.py).
"""
from datetime import datetime, timedelta, timezone


def _viaje_valido(**overrides):
    salida = datetime.now(timezone.utc) + timedelta(days=2)
    payload = {
        "origin": "Medellín, Antioquia",
        "destination": "Rionegro, Antioquia",
        "departure_time": salida.isoformat(),
        "trip_type": "ONE_WAY",
        "adults_count": 2,
        "children_count": 0,
        "has_pets": False,
    }
    payload.update(overrides)
    return payload


def _publicar_viaje(client, pasajero, auth_headers, **overrides):
    return client.post(
        "/api/service-requests/",
        json=_viaje_valido(**overrides),
        headers=auth_headers(pasajero),
    )


def _viaje_con_oferta(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, precio=85000):
    pasajero = crear_pasajero()
    conductor, vehiculo = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()
    oferta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": precio},
        headers=auth_headers(conductor),
    ).json()
    return pasajero, conductor, vehiculo, viaje, oferta


# ── Rechazar oferta ──────────────────────────────────────────────────────

def test_rechazar_oferta_exitoso(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, _v, viaje, oferta = _viaje_con_oferta(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/reject",
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado_oferta"] == "REJECTED"


def test_rechazar_oferta_rechaza_si_no_es_el_dueno(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    _pasajero, conductor, _v, _viaje, oferta = _viaje_con_oferta(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    intruso = crear_pasajero(email="intruso.reject@example.com")

    respuesta = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/reject",
        headers=auth_headers(intruso),
    )
    assert respuesta.status_code == 403


# ── Contraoferta ─────────────────────────────────────────────────────────

def test_contraoferta_exitosa(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, _conductor, _v, _viaje, oferta = _viaje_con_oferta(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/counter-offer",
        json={"offered_price": 70000},
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nuevo_precio"] == 70000
    assert cuerpo["nuevo_estado"] == "PASSENGER_COUNTER_OFFERED"


def test_contraoferta_rechaza_precio_invalido(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, _conductor, _v, _viaje, oferta = _viaje_con_oferta(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/counter-offer",
        json={"offered_price": -10},
        headers=auth_headers(pasajero),
    )
    assert respuesta.status_code == 422


def test_conductor_acepta_su_propia_contraoferta_via_resolve(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, conductor, _v, _viaje, oferta = _viaje_con_oferta(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/counter-offer",
        json={"offered_price": 70000},
        headers=auth_headers(pasajero),
    )

    respuesta = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/resolve",
        json={"action": "ACCEPT"},
        headers=auth_headers(conductor),
    )
    assert respuesta.status_code == 200


# ── Cancelar viaje ───────────────────────────────────────────────────────

def test_cancelar_viaje_pendiente(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    respuesta = client.patch(
        f"/api/service-requests/{viaje['request_id']}/cancel",
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["status"] == "CANCELLED"


def test_cancelar_viaje_rechaza_si_no_es_el_dueno(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()
    intruso = crear_pasajero(email="intruso.cancel@example.com")
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    respuesta = client.patch(
        f"/api/service-requests/{viaje['request_id']}/cancel",
        headers=auth_headers(intruso),
    )
    assert respuesta.status_code == 403


def test_cancelar_viaje_ya_asignado_falla(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, _conductor, _v, viaje, oferta = _viaje_con_oferta(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    client.patch(f"/api/service-requests/offers/{oferta['offer_id']}/accept", headers=auth_headers(pasajero))

    respuesta = client.patch(
        f"/api/service-requests/{viaje['request_id']}/cancel",
        headers=auth_headers(pasajero),
    )
    assert respuesta.status_code == 400


# ── Radar del conductor (/pending) ───────────────────────────────────────

def test_pending_pasajero_ve_solo_sus_viajes(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()
    otro = crear_pasajero(email="otro.pending@example.com")
    _publicar_viaje(client, pasajero, auth_headers)
    _publicar_viaje(client, otro, auth_headers)

    respuesta = client.get("/api/service-requests/pending", headers=auth_headers(pasajero))

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["passenger_id"] == pasajero.user_id


def test_pending_conductor_ve_viajes_estandar_pendientes(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero = crear_pasajero()
    conductor, _v = crear_conductor_con_vehiculo()
    _publicar_viaje(client, pasajero, auth_headers)

    respuesta = client.get("/api/service-requests/pending", headers=auth_headers(conductor))

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1
