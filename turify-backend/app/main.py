from app.routers import auth, drivers, service_requests, admin
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.audit import registrar_log
from app.security_headers import SecurityHeadersMiddleware
from app.error_handlers import registrar_manejadores_de_errores, ES_PRODUCCION
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.rate_limit import limiter, manejar_limite_excedido

# Crea las tablas automáticamente (incluye AuditLog)
Base.metadata.create_all(bind=engine)

# HU (OWASP A05) — en produccion se ocultan /docs, /redoc y el esquema
# OpenAPI para no exponer la estructura interna de la API.
app = FastAPI(
    title="Turify API",
    docs_url=None if ES_PRODUCCION else "/docs",
    redoc_url=None if ES_PRODUCCION else "/redoc",
    openapi_url=None if ES_PRODUCCION else "/openapi.json",
)

registrar_manejadores_de_errores(app)

# HU seguridad (OWASP A07) — rate limiting global por IP. El limite fijo de
# /users/login (5 intentos / 5 min) se agrega directamente en ese endpoint;
# este limite general es una defensa adicional contra abuso/DoS en el resto
# de la API.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, manejar_limite_excedido)
app.add_middleware(SlowAPIMiddleware)

# HU31 — Cabeceras de seguridad HTTP (X-Frame-Options, X-Content-Type-Options,
# Content-Security-Policy, Strict-Transport-Security).
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # HU seguridad (OWASP A07) - por defecto el navegador oculta los headers
    # de respuesta que no esten en esta lista; sin esto, el frontend nunca
    # veria X-Captcha-Required aunque el backend si lo mande.
    expose_headers=["X-Captcha-Required"],
)

# Routers
app.include_router(auth.router)
app.include_router(drivers.router)
app.include_router(service_requests.router)
app.include_router(admin.router)

# Endpoint de salud liviano, sin autenticacion ni logica de negocio -- lo usan
# las plataformas de despliegue (Render, Railway, etc.) para saber si el
# contenedor esta arriba y respondiendo.
@app.get("/healthz")
def healthz():
    return {"status": "ok"}
