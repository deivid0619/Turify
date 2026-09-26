"""
SCRUM-252 — cédula del conductor por ambos lados. Los conductores registrados
antes de que se pidiera la suben aparte con POST /drivers/upload-cedula.
"""
from app import models


def _png():
    return b"\x89PNG\r\n\x1a\n" + b"0" * 32


def _sin_llamar_a_supabase(monkeypatch):
    async def _fake_upload(*args, **kwargs):
        return "https://fake.supabase.co/storage/v1/object/sign/turify-documentos/drivers/fake/cedula"

    monkeypatch.setattr("app.routers.drivers.get_supabase", lambda: None)
    monkeypatch.setattr("app.routers.drivers.upload_to_supabase", _fake_upload)


def _archivos():
    return {
        "doc_cedula_frente": ("frente.png", _png(), "image/png"),
        "doc_cedula_reverso": ("reverso.png", _png(), "image/png"),
    }


def test_conductor_sube_la_cedula_por_ambos_lados(
    client, crear_conductor_con_vehiculo, auth_headers, db_session, monkeypatch
):
    _sin_llamar_a_supabase(monkeypatch)
    conductor, _v = crear_conductor_con_vehiculo()

    respuesta = client.post("/drivers/upload-cedula", files=_archivos(), headers=auth_headers(conductor))

    assert respuesta.status_code == 200
    tipos = {
        d.document_type: d.verification_status
        for d in db_session.query(models.Document).filter(models.Document.user_id == conductor.user_id)
    }
    assert tipos == {"Cedula frente": "PENDING", "Cedula reverso": "PENDING"}


def test_no_se_puede_reenviar_la_cedula_mientras_esta_en_revision(
    client, crear_conductor_con_vehiculo, auth_headers, monkeypatch
):
    _sin_llamar_a_supabase(monkeypatch)
    conductor, _v = crear_conductor_con_vehiculo()
    client.post("/drivers/upload-cedula", files=_archivos(), headers=auth_headers(conductor))

    respuesta = client.post("/drivers/upload-cedula", files=_archivos(), headers=auth_headers(conductor))

    assert respuesta.status_code == 400


def test_un_pasajero_no_usa_este_endpoint(client, crear_pasajero, auth_headers, monkeypatch):
    _sin_llamar_a_supabase(monkeypatch)
    pasajero = crear_pasajero()

    respuesta = client.post("/drivers/upload-cedula", files=_archivos(), headers=auth_headers(pasajero))

    assert respuesta.status_code == 403
