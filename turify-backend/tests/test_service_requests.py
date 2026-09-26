"""
SCRUM-193 (HU45) — Tests automatizados: crear viaje, enviar oferta y
aceptar oferta (los tres flujos críticos de la negociación de Turify).
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


# ── Crear viaje ──────────────────────────────────────────────────────────────────────

def test_crear_viaje_exitoso(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()

    respuesta = _publicar_viaje(client, pasajero, auth_headers)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["status"] == "PENDING"
    assert cuerpo["origin"] == "Medellín, Antioquia"
    assert cuerpo["passenger_id"] == pasajero.user_id


def test_crear_viaje_rechaza_sin_autenticacion(client):
    respuesta = client.post("/api/service-requests/", json=_viaje_valido())
    assert respuesta.status_code == 401


def test_crear_viaje_rechaza_fecha_pasada(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()
    ayer = datetime.now(timezone.utc) - timedelta(days=1)

    respuesta = _publicar_viaje(client, pasajero, auth_headers, departure_time=ayer.isoformat())

    # El validador de Pydantic (ServiceRequestCreate.validate_dates) lo
    # rechaza antes de que el request llegue al endpoint.
    assert respuesta.status_code == 422


def test_crear_viaje_ida_y_vuelta_exige_fecha_regreso(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()

    respuesta = _publicar_viaje(client, pasajero, auth_headers, trip_type="ROUND_TRIP")

    assert respuesta.status_code == 422


# SCRUM-254 — mascotas solo en guacal o transportadora.
def test_crear_viaje_con_mascota_sin_confirmar_guacal_falla(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()

    respuesta = _publicar_viaje(client, pasajero, auth_headers, has_pets=True)

    assert respuesta.status_code == 400
    assert "guacal" in respuesta.json()["detail"]


def test_crear_viaje_con_mascota_en_guacal(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()

    respuesta = _publicar_viaje(client, pasajero, auth_headers, has_pets=True, mascotas_en_guacal=True)

    assert respuesta.status_code == 201
    assert respuesta.json()["has_pets"] is True


# ── Enviar oferta ──────────────────────────────────────────────────────────────────────

def test_enviar_oferta_exitoso(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero = crear_pasajero()
    conductor, _vehiculo = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 85000},
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["offered_price"] == 85000
    assert "offer_id" in cuerpo


def test_enviar_oferta_rechaza_si_no_es_conductor(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()
    otro_pasajero = crear_pasajero(email="otro.pasajero@example.com")
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 50000},
        headers=auth_headers(otro_pasajero),
    )

    assert respuesta.status_code == 403


def test_enviar_oferta_rechaza_precio_invalido(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero = crear_pasajero()
    conductor, _vehiculo = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 0},
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 422


def test_enviar_oferta_rechaza_sin_vehiculo_registrado(client, crear_pasajero, db_session, auth_headers):
    from app import models, security

    pasajero = crear_pasajero()
    conductor_sin_vehiculo = models.User(
        full_name="Conductor Sin Vehiculo",
        email="sin.vehiculo@example.com",
        phone_number="3009998877",
        password_hash=security.get_password_hash("ClaveSegura123"),
        role="DRIVER",
    )
    db_session.add(conductor_sin_vehiculo)
    db_session.commit()
    db_session.refresh(conductor_sin_vehiculo)

    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 60000},
        headers=auth_headers(conductor_sin_vehiculo),
    )

    assert respuesta.status_code == 400
    assert "vehículo" in respuesta.json()["detail"]


# ── Aceptar oferta ──────────────────────────────────────────────────────────────────────

def test_aceptar_oferta_exitoso(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero = crear_pasajero()
    conductor, _vehiculo = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    oferta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 90000},
        headers=auth_headers(conductor),
    ).json()

    respuesta = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/accept",
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado_oferta"] == "ACCEPTED"
    assert cuerpo["estado_viaje"] == "ASSIGNED"


def test_aceptar_oferta_rechaza_si_no_es_el_dueno_del_viaje(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero = crear_pasajero()
    intruso = crear_pasajero(email="intruso@example.com")
    conductor, _vehiculo = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    oferta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 90000},
        headers=auth_headers(conductor),
    ).json()

    respuesta = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/accept",
        headers=auth_headers(intruso),
    )

    assert respuesta.status_code == 403


def test_aceptar_oferta_rechaza_oferta_inexistente(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()

    respuesta = client.patch(
        "/api/service-requests/offers/999999/accept",
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 404


def test_aceptar_oferta_rechaza_ya_aceptada(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero = crear_pasajero()
    conductor, _vehiculo = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()

    oferta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 90000},
        headers=auth_headers(conductor),
    ).json()

    primera = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/accept",
        headers=auth_headers(pasajero),
    )
    assert primera.status_code == 200

    segunda = client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/accept",
        headers=auth_headers(pasajero),
    )
    assert segunda.status_code == 400
