from app.routers import auth, drivers, service_requests, admin
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.audit import registrar_log
from app.security_headers import SecurityHeadersMiddleware
from app.error_handlers import registrar_manejadores_de_errores, ES_PRODUCCION

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

# HU31 — Cabeceras de seguridad HTTP (X-Frame-Options, X-Content-Type-Options,
# Content-Security-Policy, Strict-Transport-Security).
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(drivers.router)
app.include_router(service_requests.router)
app.include_router(admin.router)
