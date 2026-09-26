"""
SCRUM-253 — fotos reales del vehículo: el conductor sube una por tipo y el
pasajero las ve en la oferta, antes de aceptar.
"""
from datetime import datetime, timedelta, timezone


def _png():
    return b"\x89PNG\r\n\x1a\n" + b"0" * 32


def _sin_llamar_a_supabase(monkeypatch):
    contador = {"n": 0}

    async def _fake_upload(*args, **kwargs):
        contador["n"] += 1
        return f"https://fake.supabase.co/storage/v1/object/sign/turify-fotos/vehiculo/{contador['n']}"

    monkeypatch.setattr("app.routers.drivers.get_supabase", lambda: None)
    monkeypatch.setattr("app.routers.drivers.upload_to_supabase", _fake_upload)


def _subir(client, headers, tipo):
    return client.post(
        "/drivers/vehicle/photos",
        data={"tipo": tipo},
        files={"archivo": ("foto.png", _png(), "image/png")},
        headers=headers,
    )


def test_conductor_sube_fotos_y_reemplaza_la_del_mismo_tipo(
    client, crear_conductor_con_vehiculo, auth_headers, monkeypatch
):
    _sin_llamar_a_supabase(monkeypatch)
    conductor, _v = crear_conductor_con_vehiculo()
    h = auth_headers(conductor)

    assert _subir(client, h, "EXTERIOR_FRENTE").status_code == 200
    assert _subir(client, h, "INTERIOR").status_code == 200
    respuesta = _subir(client, h, "EXTERIOR_FRENTE")  # la reemplaza, no la duplica

    fotos = respuesta.json()["fotos"]
    assert sorted(f["tipo"] for f in fotos) == ["EXTERIOR_FRENTE", "INTERIOR"]
    assert client.get("/drivers/vehicle", headers=h).json()["fotos"] == fotos


def test_tipo_de_foto_invalido(client, crear_conductor_con_vehiculo, auth_headers, monkeypatch):
    _sin_llamar_a_supabase(monkeypatch)
    conductor, _v = crear_conductor_con_vehiculo()

    assert _subir(client, auth_headers(conductor), "SELFIE").status_code == 400


def test_el_pasajero_ve_las_fotos_en_la_oferta(
    client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers, monkeypatch
):
    _sin_llamar_a_supabase(monkeypatch)
    pasajero = crear_pasajero()
    conductor, _v = crear_conductor_con_vehiculo()
    _subir(client, auth_headers(conductor), "EXTERIOR_FRENTE")
    _subir(client, auth_headers(conductor), "INTERIOR")

    salida = datetime.now(timezone.utc) + timedelta(days=3)
    viaje = client.post("/api/service-requests/", json={
        "origin": "Medellín, Antioquia", "destination": "Rionegro, Antioquia",
        "departure_time": salida.isoformat(), "trip_type": "ONE_WAY",
        "adults_count": 2, "children_count": 0, "has_pets": False,
    }, headers=auth_headers(pasajero)).json()
    client.post(f"/api/service-requests/{viaje['request_id']}/offers",
                json={"offered_price": 90000}, headers=auth_headers(conductor))

    ofertas = client.get(f"/api/service-requests/{viaje['request_id']}/offers", headers=auth_headers(pasajero)).json()

    assert len(ofertas[0]["vehiculo_fotos"]) == 2
