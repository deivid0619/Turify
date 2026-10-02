"""Wompi — el anticipo pagado en la app (SCRUM-179/180).

Flujo:
  1. El pasajero toca "Pagar en línea": el backend arma la URL del Web
     Checkout de Wompi con una firma de integridad (así nadie puede cambiar el
     monto ni la referencia en el navegador).
  2. El pasajero paga en Wompi (tarjeta, PSE, Nequi, Bancolombia...) y Wompi
     lo devuelve a Turify con ?id=<transacción>.
  3. El backend confirma el resultado por dos caminos, el que llegue primero:
     consultando la transacción en la API de Wompi (cuando el pasajero
     vuelve) y con el evento firmado que Wompi le manda al webhook (aunque el
     pasajero cierre la pestaña).

Se activa solo cuando están las tres llaves en el entorno. El ambiente
(sandbox o producción) sale de la llave pública: pub_test_… o pub_prod_….

Documentación: https://docs.wompi.co/docs/colombia/widget-checkout-web/
               https://docs.wompi.co/docs/colombia/eventos/
"""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

URL_CHECKOUT = "https://checkout.wompi.co/p/"
URL_API = {"sandbox": "https://sandbox.wompi.co/v1", "produccion": "https://production.wompi.co/v1"}

# El link de pago vence a la hora: si el viaje se cancela mientras tanto, no
# queda una pestaña vieja con la que se pueda pagar un anticipo anulado.
MINUTOS_VIGENCIA_CHECKOUT = 60

# TFY000128-P57-a1b2c3d4 → viaje 128, pago 57. El sufijo hace única cada
# referencia: Wompi no admite repetirla y el pasajero puede reintentar.
_REFERENCIA = re.compile(r"^TFY(\d{6,})-P(\d+)-[0-9a-f]{8}$")
_ID_TRANSACCION = re.compile(r"^[A-Za-z0-9-]{1,64}$")


def _llave(nombre: str) -> str:
    return (os.getenv(nombre) or "").strip()


def llave_publica() -> str:
    return _llave("WOMPI_PUBLIC_KEY")


def configurado() -> bool:
    return all(_llave(n) for n in ("WOMPI_PUBLIC_KEY", "WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET"))


def ambiente() -> str:
    return "produccion" if llave_publica().startswith("pub_prod_") else "sandbox"


def nueva_referencia(request_id: int, pago_id: int) -> str:
    return f"TFY{request_id:06d}-P{pago_id}-{secrets.token_hex(4)}"


def leer_referencia(referencia: str):
    """(request_id, pago_id) de una referencia de Turify, o None si no es nuestra."""
    m = _REFERENCIA.match(referencia or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


def id_transaccion_valido(transaccion_id: str) -> bool:
    return bool(_ID_TRANSACCION.match(transaccion_id or ""))


def firma_integridad(referencia: str, centavos: int, vence: str) -> str:
    cadena = f"{referencia}{centavos}COP{vence}{_llave('WOMPI_INTEGRITY_SECRET')}"
    return hashlib.sha256(cadena.encode()).hexdigest()


def url_checkout(referencia: str, centavos: int, redirigir_a: str | None) -> str:
    vence = (datetime.now(timezone.utc) + timedelta(minutes=MINUTOS_VIGENCIA_CHECKOUT)).strftime(
        "%Y-%m-%dT%H:%M:%S.000Z")
    parametros = {
        "public-key": llave_publica(),
        "currency": "COP",
        "amount-in-cents": str(centavos),
        "reference": referencia,
        "expiration-time": vence,
        "signature:integrity": firma_integridad(referencia, centavos, vence),
    }
    if redirigir_a:
        parametros["redirect-url"] = redirigir_a
    # Los dos puntos van tal cual ("signature:integrity", la hora), como en
    # los ejemplos de Wompi.
    return f"{URL_CHECKOUT}?{urlencode(parametros, safe=':/')}"


def _valor(datos: dict, ruta: str):
    actual = datos
    for parte in ruta.split("."):
        if not isinstance(actual, dict):
            return None
        actual = actual.get(parte)
    return actual


def evento_autentico(evento: dict) -> bool:
    """Verifica la firma de un evento del webhook: SHA-256 de los valores de
    signature.properties (en orden) + timestamp + el secreto de eventos."""
    firma = evento.get("signature") or {}
    propiedades = firma.get("properties")
    recibido = str(firma.get("checksum") or "")
    if not isinstance(propiedades, list) or not propiedades or not recibido or evento.get("timestamp") is None:
        return False
    datos = evento.get("data") or {}
    valores = "".join("" if (v := _valor(datos, p)) is None else str(v) for p in propiedades)
    cadena = f"{valores}{evento['timestamp']}{_llave('WOMPI_EVENTS_SECRET')}"
    esperado = hashlib.sha256(cadena.encode()).hexdigest()
    return hmac.compare_digest(esperado.upper(), recibido.upper())


def consultar_transaccion(transaccion_id: str) -> dict:
    """La transacción tal como la tiene Wompi (endpoint público de su API)."""
    respuesta = httpx.get(f"{URL_API[ambiente()]}/transactions/{transaccion_id}", timeout=15)
    respuesta.raise_for_status()
    return respuesta.json().get("data") or {}
