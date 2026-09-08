"""
SCRUM-193 (HU45) — Tests automatizados: registro e inicio de sesión.
"""


def test_registro_pasajero_exitoso(client):
    respuesta = client.post("/users/register", json={
        "full_name": "Ana Torres",
        "email": "ana.torres@example.com",
        "password": "ClaveSegura123",
        "phone_number": "3001112233",
    })

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["email"] == "ana.torres@example.com"
    assert cuerpo["full_name"] == "Ana Torres"
    assert cuerpo["role"] == "PASSENGER"
    assert "user_id" in cuerpo


def test_registro_rechaza_email_duplicado(client):
    payload = {
        "full_name": "Carlos Ruiz",
        "email": "carlos.ruiz@example.com",
        "password": "ClaveSegura123",
        "phone_number": "3002223344",
    }
    primera = client.post("/users/register", json=payload)
    assert primera.status_code == 201

    segunda = client.post("/users/register", json=payload)
    assert segunda.status_code == 400
    assert "Email is already registered" in segunda.json()["detail"]


def test_registro_rechaza_telefono_invalido(client):
    respuesta = client.post("/users/register", json={
        "full_name": "Luisa Pérez",
        "email": "luisa.perez@example.com",
        "password": "ClaveSegura123",
        "phone_number": "abc123",
    })
    assert respuesta.status_code == 422


def test_registro_rechaza_password_corta(client):
    respuesta = client.post("/users/register", json={
        "full_name": "Mario Gómez",
        "email": "mario.gomez@example.com",
        "password": "corta",
        "phone_number": "3003334455",
    })
    assert respuesta.status_code == 422


def test_registro_rechaza_nombre_con_numeros(client):
    respuesta = client.post("/users/register", json={
        "full_name": "Mario123",
        "email": "mario.numeros@example.com",
        "password": "ClaveSegura123",
        "phone_number": "3003334455",
    })
    assert respuesta.status_code == 422


def test_login_exitoso(client, crear_pasajero):
    crear_pasajero(email="login.ok@example.com", password="ClaveSegura123")

    respuesta = client.post("/users/login", data={
        "username": "login.ok@example.com",
        "password": "ClaveSegura123",
    })

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["token_type"] == "bearer"
    assert cuerpo["access_token"]


def test_login_rechaza_password_incorrecta(client, crear_pasajero):
    crear_pasajero(email="login.mal@example.com", password="ClaveSegura123")

    respuesta = client.post("/users/login", data={
        "username": "login.mal@example.com",
        "password": "OtraClaveXYZ",
    })

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == "Email o contraseña incorrectos"


def test_login_rechaza_usuario_inexistente(client):
    respuesta = client.post("/users/login", data={
        "username": "no.existe@example.com",
        "password": "ClaveSegura123",
    })
    assert respuesta.status_code == 400


def test_me_requiere_autenticacion(client):
    respuesta = client.get("/users/me")
    assert respuesta.status_code == 401


def test_me_devuelve_perfil_del_token(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero(email="perfil@example.com")

    respuesta = client.get("/users/me", headers=auth_headers(pasajero))

    assert respuesta.status_code == 200
    assert respuesta.json()["email"] == "perfil@example.com"
