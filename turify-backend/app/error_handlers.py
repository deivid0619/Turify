"""
HU — Ocultar errores internos en producción (OWASP A05).

Handlers globales de errores para FastAPI: un error no manejado (o un error
de base de datos) nunca debe devolver al cliente un stack trace, ni el
mensaje interno de la excepción, ni mucho menos la estructura de tablas o
la query SQL que falló. El detalle completo siempre se registra en los
logs del servidor (visibles con `docker compose logs backend`), nunca en
la respuesta HTTP.

La variable de entorno ENV controla el nivel de detalle:
- ENV=production  → solo el mensaje genérico en la respuesta.
- cualquier otro valor (o sin definir, por defecto "development") → además
  del mensaje genérico se agrega un campo "debug" con el tipo y mensaje de
  la excepción (nunca el traceback completo), para facilitar depurar en local.

Esto NO reemplaza las HTTPException que ya lanzan los endpoints a propósito
(ej. "Credenciales inválidas", "Viaje no encontrado") — esas conservan su
mensaje normal, FastAPI las maneja aparte porque son más específicas.
"""
import logging
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("turify")

ENV = os.getenv("ENV", "development")
ES_PRODUCCION = ENV == "production"

MENSAJE_GENERICO = "Ocurrió un error interno. Por favor intenta de nuevo más tarde."


def _registrar_en_logs(request: Request, exc: Exception) -> None:
    logger.error(
        "Error no manejado en %s %s: %r\n%s",
        request.method,
        request.url.path,
        exc,
        traceback.format_exc(),
    )


def _respuesta_generica(exc: Exception) -> JSONResponse:
    contenido = {"detail": MENSAJE_GENERICO}
    if not ES_PRODUCCION:
        # Solo en desarrollo: tipo y mensaje de la excepción, nunca el traceback.
        contenido["debug"] = f"{type(exc).__name__}: {exc}"
    return JSONResponse(status_code=500, content=contenido)


def registrar_manejadores_de_errores(app: FastAPI) -> None:
    @app.exception_handler(SQLAlchemyError)
    async def manejar_error_bd(request: Request, exc: SQLAlchemyError):
        # Un error de BD puede traer en su mensaje la query completa y los
        # nombres de tablas/columnas (como pasó con la columna faltante de
        # conductor_verificado) — eso se queda en el log del servidor, jamás
        # en la respuesta.
        _registrar_en_logs(request, exc)
        return _respuesta_generica(exc)

    @app.exception_handler(Exception)
    async def manejar_error_generico(request: Request, exc: Exception):
        _registrar_en_logs(request, exc)
        return _respuesta_generica(exc)
