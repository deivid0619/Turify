"""
HU31 — Cabeceras de seguridad HTTP.

Middleware que agrega cabeceras HTTP de seguridad a todas las respuestas
del backend, para mitigar XSS, clickjacking, sniffing de MIME type y
forzar HTTPS en producción (OWASP A05 - Mala configuración de seguridad).
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# La UI de Swagger (/docs) y ReDoc (/redoc) cargan sus propios scripts/estilos
# desde un CDN externo (cdn.jsdelivr.net) y usan <script>/<style> inline, así
# que una Content-Security-Policy estricta las rompe. Se excluyen de la CSP
# (siguen recibiendo el resto de cabeceras) — en producción, además, se
# recomienda desactivar /docs y /redoc por completo (ver SCRUM-217).
_RUTAS_SIN_CSP_ESTRICTA = {"/docs", "/redoc", "/openapi.json"}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Evita que la API sea embebida en un <iframe> de otro sitio (clickjacking).
        response.headers["X-Frame-Options"] = "DENY"

        # Evita que el navegador intente "adivinar" el tipo de contenido
        # (MIME sniffing), lo cual puede permitir ejecutar HTML/JS disfrazado
        # de otro tipo de archivo.
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Fuerza HTTPS en el navegador durante 2 años, incluyendo subdominios.
        # No tiene efecto sobre HTTP plano (ej. localhost en desarrollo), los
        # navegadores solo la respetan en un contexto seguro (HTTPS).
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )

        # No enviar la URL completa como referrer a sitios externos.
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        if request.url.path not in _RUTAS_SIN_CSP_ESTRICTA:
            # Esta es una API JSON pura: no sirve HTML propio ni necesita
            # cargar scripts/estilos/imágenes de ningún origen.
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
            )

        return response
