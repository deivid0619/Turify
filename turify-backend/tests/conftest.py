"""
Configuración compartida de pytest (SCRUM-193 / HU45).

Los tests corren contra una base de datos Postgres real (no SQLite: el
esquema usa tipos específicos de Postgres como JSONB y TIMESTAMP WITH TIME
ZONE que SQLite no soporta), pero NUNCA contra la base de datos de
desarrollo o producción — el nombre de esa base de datos de test se lee de
TEST_DATABASE_URL, con un valor por defecto pensado para correr junto al
Postgres del docker-compose local.

Cada test corre dentro de su propia transacción, que se revierte
(rollback) al terminar, así que los tests nunca se contaminan entre sí ni
dejan basura en la base de datos.
"""
import os
import sys
from pathlib import Path

# Aseguramos que el paquete "app" se pueda importar sin importar desde qué
# directorio se invoque pytest.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# OJO: estas variables de entorno se deben fijar ANTES de importar app.database
# o app.main, porque ambos leen SUPABASE_DB_URL/SQLALCHEMY_DATABASE_URL al
# momento de importarse (y app.main crea las tablas apenas se importa).
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:1234@localhost:5432/turify_test",
)
os.environ["SUPABASE_DB_URL"] = TEST_DATABASE_URL
os.environ["SQLALCHEMY_DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("SECRET_KEY", "clave-de-test-no-usar-en-produccion")
# Nunca se debe exigir un reCAPTCHA real en los tests.
os.environ.pop("RECAPTCHA_SECRET_KEY", None)

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine, get_db
from app.main import app
from app import models, security


@pytest.fixture(scope="session", autouse=True)
def _esquema_de_test():
    """Crea las tablas en la base de datos de test si todavía no existen.

    (app.main ya llama a Base.metadata.create_all al importarse, esto es
    solo una red de seguridad explícita y no falla si las tablas ya están.)
    """
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def db_session():
    """Una sesión de SQLAlchemy atada a una única conexión + transacción
    externa que se revierte al final del test (patrón estándar de testing
    de FastAPI/SQLAlchemy). join_transaction_mode="create_savepoint" permite
    que el código de la app llame a session.commit() con total normalidad
    (por ejemplo, audit.registrar_log hace su propio commit) sin que eso
    termine la transacción externa: cada commit cierra un SAVEPOINT y abre
    el siguiente automáticamente.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection, join_transaction_mode="create_savepoint")

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    """TestClient de FastAPI que usa la sesión de test (con rollback
    automático) en vez de conectarse a la base de datos real."""

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def crear_pasajero(db_session):
    """Crea (directo en la base de datos, sin pasar por /users/register) un
    usuario PASSENGER listo para usar en un test."""

    def _crear(email="pasajero@test.com", password="ClaveSegura123", **overrides):
        datos = dict(
            full_name="Pasajero de Prueba",
            email=email,
            phone_number="3001234567",
            password_hash=security.get_password_hash(password),
            role="PASSENGER",
        )
        datos.update(overrides)
        user = models.User(**datos)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _crear


@pytest.fixture()
def crear_conductor_con_vehiculo(db_session):
    """Crea un usuario DRIVER con un vehículo registrado (necesario para
    poder enviar ofertas)."""

    def _crear(email="conductor@test.com", password="ClaveSegura123", comodidades=None):
        driver = models.User(
            full_name="Conductor de Prueba",
            email=email,
            phone_number="3007654321",
            password_hash=security.get_password_hash(password),
            role="DRIVER",
        )
        db_session.add(driver)
        db_session.commit()
        db_session.refresh(driver)

        vehicle = models.Vehicle(
            owner_id=driver.user_id,
            plate=f"TST{driver.user_id:04d}",
            capacity=4,
            **(comodidades or {}),
        )
        db_session.add(vehicle)
        db_session.commit()
        db_session.refresh(vehicle)
        return driver, vehicle

    return _crear


@pytest.fixture()
def auth_headers():
    """Genera el header Authorization directamente con security.create_access_token,
    sin pasar por /users/login — así los tests de viajes/ofertas no consumen el
    límite de intentos de login (5 cada 5 minutos) que sí se prueba a propósito
    en test_auth.py."""

    def _headers(user):
        token = security.create_access_token(data={"sub": str(user.user_id)})
        return {"Authorization": f"Bearer {token}"}

    return _headers
