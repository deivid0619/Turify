"""
Autorización de tratamiento de datos (Ley 1581 de 2012). Sin la casilla no
se crea la cuenta, y la prueba queda en AuditLog con la versión aceptada.
"""
from app import consentimiento, models
from app.routers import auth, drivers
from tests.test_fuec_representante import _ocupante, _viaje_asignado


def _registro(**extra):
    datos = {
        "full_name": "Ana Torres",
        "email": "ana.consentimiento@example.com",
        "password": "ClaveSegura123",
        "phone_number": "3001112233",
    }
    datos.update(extra)
    return datos


def _pruebas(db_session, user_id, accion=consentimiento.ACEPTA_POLITICAS):
    return db_session.query(models.AuditLog).filter(
        models.AuditLog.user_id == user_id, models.AuditLog.action == accion).all()


def test_registro_sin_autorizacion_no_crea_la_cuenta(client, db_session):
    respuesta = client.post("/users/register", json=_registro())

    assert respuesta.status_code == 400
    assert "Términos" in respuesta.json()["detail"]
    assert db_session.query(models.User).filter(
        models.User.email == "ana.consentimiento@example.com").first() is None


def test_registro_guarda_la_prueba_de_la_autorizacion(client, db_session, auth_headers):
    respuesta = client.post("/users/register", json=_registro(acepta_politicas=True))

    assert respuesta.status_code == 201
    usuario = db_session.get(models.User, respuesta.json()["user_id"])
    pruebas = _pruebas(db_session, usuario.user_id)
    assert len(pruebas) == 1
    assert pruebas[0].detail.startswith(f"[{consentimiento.VERSION_POLITICAS}]")
    vista = client.get("/users/me/autorizacion-datos", headers=auth_headers(usuario)).json()
    assert vista == {"vigente": True, "version": consentimiento.VERSION_POLITICAS}


def test_cuenta_antigua_acepta_desde_el_aviso_una_sola_vez(client, db_session, crear_pasajero, auth_headers):
    antiguo = crear_pasajero(email="antiguo@example.com")
    url = "/users/me/autorizacion-datos"

    assert client.get(url, headers=auth_headers(antiguo)).json()["vigente"] is False
    assert client.post(url, headers=auth_headers(antiguo)).json()["vigente"] is True
    client.post(url, headers=auth_headers(antiguo))

    assert client.get(url, headers=auth_headers(antiguo)).json()["vigente"] is True
    assert len(_pruebas(db_session, antiguo.user_id)) == 1


def test_cuenta_nueva_con_google_exige_la_autorizacion(client, db_session, crear_pasajero, monkeypatch):
    monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "cliente-de-prueba")
    correo = {"email": "nuevo.google@example.com"}
    monkeypatch.setattr(auth.google_id_token, "verify_oauth2_token", lambda *a, **k: {
        "email": correo["email"], "email_verified": True, "name": "Nuevo Google"})

    sin_aviso = client.post("/users/login-google", json={"credential": "token"})
    assert sin_aviso.status_code == 400
    assert db_session.query(models.User).filter(models.User.email == correo["email"]).first() is None

    con_aviso = client.post("/users/login-google", json={"credential": "token", "acepta_politicas": True})
    assert con_aviso.status_code == 200 and con_aviso.json()["is_new_user"] is True
    nuevo = db_session.query(models.User).filter(models.User.email == correo["email"]).one()
    assert len(_pruebas(db_session, nuevo.user_id)) == 1

    # Una cuenta que ya existe entra sin volver a marcar nada.
    crear_pasajero(email="ya.existe@example.com")
    correo["email"] = "ya.existe@example.com"
    assert client.post("/users/login-google", json={"credential": "token"}).status_code == 200


def test_ocupantes_exigen_la_autorizacion_de_sus_datos(
        client, db_session, crear_pasajero, crear_conductor_con_vehiculo, auth_headers):
    pasajero, _c, _v, viaje = _viaje_asignado(client, crear_pasajero, crear_conductor_con_vehiculo, auth_headers)
    url = f"/api/service-requests/{viaje['request_id']}/passengers"

    sin = client.post(url, json={"passengers": [_ocupante(representante=True)]}, headers=auth_headers(pasajero))
    assert sin.status_code == 400
    assert db_session.query(models.TripPassenger).filter(
        models.TripPassenger.request_id == viaje["request_id"]).count() == 0

    con = client.post(url, json={"autorizacion_ocupantes": True, "passengers": [_ocupante(representante=True)]},
                      headers=auth_headers(pasajero))
    assert con.status_code == 201
    assert len(_pruebas(db_session, pasajero.user_id, consentimiento.AUTORIZA_OCUPANTES)) == 1


def test_registro_de_conductor_exige_autorizar_documentos_y_ubicacion(
        client, crear_pasajero, auth_headers, monkeypatch):
    def _no_subir(*_a, **_k):
        raise AssertionError("No debe subir nada sin la autorización")
    monkeypatch.setattr(drivers, "get_supabase", _no_subir)

    futuro = crear_pasajero(email="futuro.conductor@example.com")
    png = ("doc.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")
    archivos = {nombre: png for nombre in (
        "profile_photo", "vehicle_photo", "doc_soat", "doc_licencia", "doc_tarjeta_operacion",
        "doc_tecnomecanica", "doc_seguros", "doc_cedula_frente", "doc_cedula_reverso")}

    respuesta = client.post("/drivers/register-details", headers=auth_headers(futuro), files=archivos,
                            data={"age": "35", "plate": "ABC123", "capacity": "12", "affiliated_company": "1"})

    assert respuesta.status_code == 400
    assert "ubicación" in respuesta.json()["detail"]


def test_bitacora_y_notificaciones_se_guardan_sin_returning():
    """En producción el backend entra como turify_app, que respeta RLS, y
    Postgres exige poder leer la fila que devuelve INSERT ... RETURNING. La
    bitácora y las notificaciones se escriben para otros usuarios (o sin
    sesión), así que con RETURNING el INSERT falla. Esta suite corre como
    postgres, que se salta RLS y no lo vería: por eso se prueba la tabla."""
    assert models.AuditLog.__table__.implicit_returning is False
    assert models.Notification.__table__.implicit_returning is False
