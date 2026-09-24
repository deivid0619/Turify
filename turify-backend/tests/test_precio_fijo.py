"""
ÉPICA 12 — precio fijo: cuando el pasajero publica aceptando el precio
sugerido tal cual (en vez de "negociar directamente con cada conductor"),
el conductor ya no puede ofertar otro precio — solo aceptar el viaje al
precio publicado, lo que lo asigna directo sin ronda de oferta/contraoferta.
"""
from datetime import datetime, timedelta, timezone


def _viaje_con_precio_sugerido(precio_fijo, **overrides):
    salida = datetime.now(timezone.utc) + timedelta(days=2)
    payload = {
        "origin": "Medellín, Antioquia",
        "destination": "Rionegro, Antioquia",
        "departure_time": salida.isoformat(),
        "trip_type": "ONE_WAY",
        "adults_count": 2,
        "children_count": 0,
        "has_pets": False,
        # distance_km presente → el motor de precio calcula suggested_price,
        # condición para que precio_fijo tenga algún efecto (ver create_service_request).
        "distance_km": 30.0,
        "precio_fijo": precio_fijo,
    }
    payload.update(overrides)
    return payload


def _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True, **overrides):
    return client.post(
        "/api/service-requests/",
        json=_viaje_con_precio_sugerido(precio_fijo, **overrides),
        headers=auth_headers(pasajero),
    )


def test_publicar_con_precio_fijo_lo_guarda_y_calcula_precio(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()

    respuesta = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["precio_fijo"] is True
    assert cuerpo["suggested_price"] is not None and cuerpo["suggested_price"] > 0


def test_publicar_sin_precio_fijo_queda_negociable(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()

    respuesta = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=False)

    assert respuesta.status_code == 201
    assert respuesta.json()["precio_fijo"] is False


def test_pending_expone_precio_fijo_y_suggested_price_al_conductor(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero = crear_pasajero()
    conductor, _v = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True).json()

    listado = client.get("/api/service-requests/pending", headers=auth_headers(conductor)).json()
    fila = next(r for r in listado if r["request_id"] == viaje["request_id"])

    assert fila["precio_fijo"] is True
    assert fila["suggested_price"] == viaje["suggested_price"]


# ── El conductor NO puede ofertar en un viaje de precio fijo ────────────────

def test_ofertar_rechaza_en_viaje_de_precio_fijo(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero = crear_pasajero()
    conductor, _v = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 50000},
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 400
    assert "precio fijo" in respuesta.json()["detail"]


# ── Aceptar el precio fijo: salta directo a ASSIGNED ─────────────────────────

def test_aceptar_precio_fijo_exitoso(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero = crear_pasajero()
    conductor, _v = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/accept-fixed-price",
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["offered_price"] == viaje["suggested_price"]

    estado = client.get(
        f"/api/service-requests/{viaje['request_id']}/status",
        headers=auth_headers(conductor),
    ).json()
    assert estado["status"] == "ASSIGNED"


def test_aceptar_precio_fijo_rechaza_si_no_es_conductor(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()
    viaje = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/accept-fixed-price",
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 403


def test_aceptar_precio_fijo_rechaza_sin_vehiculo(client, crear_pasajero, db_session, auth_headers):
    from app import models, security

    pasajero = crear_pasajero()
    conductor_sin_vehiculo = models.User(
        full_name="Conductor Sin Vehiculo Fijo", email="sin.vehiculo.fijo@example.com",
        phone_number="3001112222", password_hash=security.get_password_hash("ClaveSegura123"),
        role="DRIVER",
    )
    db_session.add(conductor_sin_vehiculo)
    db_session.commit()
    db_session.refresh(conductor_sin_vehiculo)

    viaje = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/accept-fixed-price",
        headers=auth_headers(conductor_sin_vehiculo),
    )

    assert respuesta.status_code == 400
    assert "vehículo" in respuesta.json()["detail"]


def test_aceptar_precio_fijo_rechaza_en_viaje_negociable(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero = crear_pasajero()
    conductor, _v = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=False).json()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/accept-fixed-price",
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 400
    assert "no tiene precio fijo" in respuesta.json()["detail"]


def test_aceptar_precio_fijo_rechaza_si_otro_conductor_ya_lo_tomo(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero = crear_pasajero()
    conductor1, _v1 = crear_conductor_con_vehiculo(email="primero@example.com")
    conductor2, _v2 = crear_conductor_con_vehiculo(email="segundo@example.com")
    viaje = _publicar_viaje(client, pasajero, auth_headers, precio_fijo=True).json()

    primero = client.post(
        f"/api/service-requests/{viaje['request_id']}/accept-fixed-price",
        headers=auth_headers(conductor1),
    )
    assert primero.status_code == 201

    segundo = client.post(
        f"/api/service-requests/{viaje['request_id']}/accept-fixed-price",
        headers=auth_headers(conductor2),
    )
    assert segundo.status_code == 400
