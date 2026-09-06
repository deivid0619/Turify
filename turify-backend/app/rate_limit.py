from slowapi import Limiter
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
