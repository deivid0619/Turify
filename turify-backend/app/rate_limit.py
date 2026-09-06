from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# HU seguridad (OWASP A07) - limitador de peticiones por IP, compartido entre
# main.py (limite global, via SlowAPIMiddleware) y los routers que necesitan
# un limite mas estricto en un endpoint puntual (por ejemplo, /users/login).
# default_limits aplica a TODOS los endpoints salvo que un endpoint declare
# su propio @limiter.limit(...) (como login, que es mas estricto).
# headers_enabled agrega X-RateLimit-* y Retry-After a las respuestas.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    headers_enabled=True,
)


async def manejar_limite_excedido(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """El manejador por defecto de slowapi responde en texto plano, pero el
    frontend siempre espera JSON con un campo "detail" (asi funcionan todos
    los demas mensajes de error). Se arma la respuesta a mano para que el
    429 se vea igual de claro que cualquier otro error, con el tiempo de
    espera exacto cuando esta disponible."""
    respuesta_base = _rate_limit_exceeded_handler(request, exc)
    espera = respuesta_base.headers.get("Retry-After")
    if espera and espera.isdigit() and int(espera) > 0:
        minutos = max(1, round(int(espera) / 60))
        unidad = "minuto" if minutos == 1 else "minutos"
        mensaje = f"Demasiados intentos. Espera unos {minutos} {unidad} antes de volver a intentarlo."
    else:
        mensaje = "Demasiados intentos. Espera unos minutos antes de volver a intentarlo."

    respuesta = JSONResponse(status_code=429, content={"detail": mensaje})
    for nombre, valor in respuesta_base.headers.items():
        respuesta.headers[nombre] = valor
    return respuesta
