"""
FUEC + representante del viaje — el FUEC en sí lo expide la empresa afiliada
del conductor (Turify solo lo recibe como archivo), y entre los ocupantes
registrados por el pasajero debe haber exactamente uno marcado como
representante del viaje, mayor de edad, para que la empresa lo use al
diligenciar el FUEC. Ninguno de los dos requisitos existía antes de esta
epica; estos tests cubren el validador de Pydantic (TripPassengersCreate),
la subida del archivo (POST /{id}/fuec) y el gate de start_trip que exige
ambos antes de dejar iniciar el viaje.
"""
from datetime import datetime, timedelta, timezone

from app import models


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


def _viaje_asignado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, precio=85000):
    """Publica un viaje, el conductor oferta y el pasajero acepta — queda en
    ASSIGNED, listo para registrar ocupantes / subir el FUEC / iniciar."""
    pasajero = crear_pasajero()
    conductor, vehiculo = crear_conductor_con_vehiculo()
    viaje = _publicar_viaje(client, pasajero, auth_headers).json()
    oferta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": precio},
        headers=auth_headers(conductor),
    ).json()
    client.patch(
        f"/api/service-requests/offers/{oferta['offer_id']}/accept",
        headers=auth_headers(pasajero),
    )
    return pasajero, conductor, vehiculo, viaje


def _ocupante(representante=False, tipo='CC', numero='1001234567', nombre='Ocupante De Prueba'):
    return {
        "full_name": nombre,
        "document_type": tipo,
        "document_number": numero,
        "es_representante": representante,
    }


# ── SCRUM-255: la lista se congela 48 h antes de la salida ──────────────────

def _viaje_asignado_con_salida(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas):
    pasajero = crear_pasajero()
    conductor, _vehiculo = crear_conductor_con_vehiculo()
    salida = datetime.now(timezone.utc) + timedelta(hours=horas)
    viaje = _publicar_viaje(client, pasajero, auth_headers, departure_time=salida.isoformat()).json()
    oferta = client.post(
        f"/api/service-requests/{viaje['request_id']}/offers",
        json={"offered_price": 85000},
        headers=auth_headers(conductor),
    ).json()
    client.patch(f"/api/service-requests/offers/{oferta['offer_id']}/accept", headers=auth_headers(pasajero))
    return pasajero, conductor, viaje


def test_ocupantes_se_pueden_cambiar_con_mas_de_48h(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero, _c, viaje = _viaje_asignado_con_salida(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=72
    )
    url = f"/api/service-requests/{viaje['request_id']}/passengers"
    assert client.post(url, json={"passengers": [_ocupante(representante=True)]}, headers=auth_headers(pasajero)).status_code == 201

    respuesta = client.post(url, json={"passengers": [
        _ocupante(representante=True), _ocupante(numero='1003333333', nombre='Otro Ocupante'),
    ]}, headers=auth_headers(pasajero))
    assert respuesta.status_code == 201


def test_ocupantes_no_se_pueden_cambiar_con_menos_de_48h(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero, _c, viaje = _viaje_asignado_con_salida(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=10
    )
    url = f"/api/service-requests/{viaje['request_id']}/passengers"
    # Primer registro: permitido aunque falten menos de 48 h (si no, nunca podría iniciar).
    assert client.post(url, json={"passengers": [_ocupante(representante=True)]}, headers=auth_headers(pasajero)).status_code == 201

    respuesta = client.post(url, json={"passengers": [
        _ocupante(representante=True), _ocupante(numero='1003333333', nombre='Otro Ocupante'),
    ]}, headers=auth_headers(pasajero))
    assert respuesta.status_code == 400
    assert "48 horas" in respuesta.json()["detail"]


def test_ocupantes_no_se_pueden_cambiar_con_el_viaje_en_curso(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session
):
    pasajero, _c, viaje = _viaje_asignado_con_salida(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, horas=72
    )
    registro = db_session.get(models.ServiceRequest, viaje['request_id'])
    registro.status = 'IN_PROGRESS'
    db_session.commit()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        json={"passengers": [_ocupante(representante=True)]},
        headers=auth_headers(pasajero),
    )
    assert respuesta.status_code == 400


# ── Registrar ocupantes: el representante del viaje ─────────────────────────

def test_registrar_ocupantes_exitoso_con_representante(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero, _conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        json={"passengers": [
            _ocupante(representante=True, numero='1001111111', nombre='Pasajero Representante'),
            _ocupante(numero='1002222222', nombre='Acompanante Uno'),
        ]},
        headers=auth_headers(pasajero),
    )
    assert respuesta.status_code == 201

    listado = client.get(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        headers=auth_headers(pasajero),
    ).json()
    representantes = [o for o in listado if o["es_representante"]]
    assert len(representantes) == 1
    assert representantes[0]["full_name"] == "Pasajero Representante"


def test_registrar_ocupantes_rechaza_sin_representante(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero, _conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        json={"passengers": [_ocupante(numero='1003333333')]},
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 422
    assert "exactamente un representante" in str(respuesta.json())


def test_registrar_ocupantes_rechaza_dos_representantes(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero, _conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        json={"passengers": [
            _ocupante(representante=True, numero='1004444444', nombre='Representante Uno'),
            _ocupante(representante=True, numero='1005555555', nombre='Representante Dos'),
        ]},
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 422
    assert "exactamente un representante" in str(respuesta.json())


def test_registrar_ocupantes_rechaza_representante_menor_con_ti(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    pasajero, _conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        json={"passengers": [
            _ocupante(representante=True, tipo='TI', numero='10066677', nombre='Menor Representante'),
        ]},
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 422
    assert "mayor de edad" in str(respuesta.json())


def test_registrar_ocupantes_rechaza_si_no_es_el_pasajero(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    _pasajero, _conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    intruso = crear_pasajero(email="intruso.ocupantes@example.com")

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        json={"passengers": [_ocupante(representante=True, numero='1007777777')]},
        headers=auth_headers(intruso),
    )

    assert respuesta.status_code == 403


# ── Subir el FUEC (archivo real, lo sube el conductor) ───────────────────────

def _archivo_png_falso():
    # Solo necesita empezar con los magic bytes reales de un PNG — es lo único
    # que _detectar_tipo_real revisa (ver app/routers/drivers.py).
    return b"\x89PNG\r\n\x1a\n" + b"0" * 32


def _sin_llamar_a_supabase(monkeypatch):
    """El endpoint de verdad sube a Supabase Storage; en los tests lo evitamos
    por completo (nada de red, nada de credenciales reales) devolviendo una
    URL falsa desde el mismo punto que usa el router."""
    async def _fake_upload(*args, **kwargs):
        return "https://fake.supabase.co/storage/v1/object/sign/turify-documentos/trips/fake/fuec"

    monkeypatch.setattr("app.routers.service_requests.get_supabase", lambda: None)
    monkeypatch.setattr("app.routers.service_requests.upload_to_supabase", _fake_upload)


def test_subir_fuec_exitoso(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, monkeypatch
):
    _sin_llamar_a_supabase(monkeypatch)
    _pasajero, conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/fuec",
        files={"archivo": ("fuec.png", _archivo_png_falso(), "image/png")},
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["fuec_url"]

    estado = client.get(
        f"/api/service-requests/{viaje['request_id']}/status",
        headers=auth_headers(conductor),
    ).json()
    assert estado["fuec_cargado"] is True


def test_subir_fuec_rechaza_si_no_es_el_conductor_asignado(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, monkeypatch
):
    _sin_llamar_a_supabase(monkeypatch)
    _pasajero, _conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    otro_conductor, _v2 = crear_conductor_con_vehiculo(email="otro.conductor@example.com")

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/fuec",
        files={"archivo": ("fuec.png", _archivo_png_falso(), "image/png")},
        headers=auth_headers(otro_conductor),
    )

    assert respuesta.status_code == 403


def test_subir_fuec_rechaza_si_el_viaje_no_esta_confirmado(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session, monkeypatch
):
    _sin_llamar_a_supabase(monkeypatch)
    _pasajero, conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    # Forzamos un estado en el que ya no se debería poder subir el FUEC.
    db_obj = db_session.query(models.ServiceRequest).get(viaje['request_id'])
    db_obj.status = 'COMPLETED'
    db_session.commit()

    respuesta = client.post(
        f"/api/service-requests/{viaje['request_id']}/fuec",
        files={"archivo": ("fuec.png", _archivo_png_falso(), "image/png")},
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 400


# ── El gate de start_trip: FUEC + representante, los dos ────────────────────

def test_iniciar_viaje_rechaza_sin_fuec_ni_ocupantes(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
):
    _pasajero, conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )

    respuesta = client.patch(
        f"/api/service-requests/{viaje['request_id']}/start",
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 400
    detalle = respuesta.json()["detail"]
    assert "FUEC" in detalle
    assert "ocupantes" in detalle


def test_iniciar_viaje_rechaza_con_fuec_pero_sin_ocupantes(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session
):
    _pasajero, conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    db_obj = db_session.query(models.ServiceRequest).get(viaje['request_id'])
    db_obj.fuec_url = "https://fake.supabase.co/fuec.pdf"
    db_session.commit()

    respuesta = client.patch(
        f"/api/service-requests/{viaje['request_id']}/start",
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 400
    detalle = respuesta.json()["detail"]
    assert "FUEC" not in detalle
    assert "ocupantes" in detalle


def test_iniciar_viaje_rechaza_sin_representante_entre_ocupantes(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session
):
    """El validador de Pydantic ya exige un representante al registrar los
    ocupantes vía API — esto prueba la revalidación directa contra la base
    que hace start_trip (ver el comentario "por si acaso" en el router),
    construyendo el estado inválido directo en la base como hacen otros
    tests de este archivo para casos que la API normal no puede producir."""
    _pasajero, conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    db_obj = db_session.query(models.ServiceRequest).get(viaje['request_id'])
    db_obj.fuec_url = "https://fake.supabase.co/fuec.pdf"
    db_session.add(models.TripPassenger(
        request_id=viaje['request_id'], full_name="Ocupante Sin Representante",
        document_type='CC', document_number='1008888888', es_representante=False,
    ))
    db_session.commit()

    respuesta = client.patch(
        f"/api/service-requests/{viaje['request_id']}/start",
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 400
    assert "representante del viaje" in respuesta.json()["detail"]


def test_iniciar_viaje_exitoso_con_fuec_y_representante(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, db_session
):
    pasajero, conductor, _v, viaje = _viaje_asignado(
        client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers
    )
    db_obj = db_session.query(models.ServiceRequest).get(viaje['request_id'])
    db_obj.fuec_url = "https://fake.supabase.co/fuec.pdf"
    db_session.commit()

    registro = client.post(
        f"/api/service-requests/{viaje['request_id']}/passengers",
        json={"passengers": [_ocupante(representante=True, numero='1009999999', nombre='Representante Del Viaje')]},
        headers=auth_headers(pasajero),
    )
    assert registro.status_code == 201

    respuesta = client.patch(
        f"/api/service-requests/{viaje['request_id']}/start",
        headers=auth_headers(conductor),
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["status"] == "IN_PROGRESS"
