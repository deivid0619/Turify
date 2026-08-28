from app.routers import auth, drivers, service_requests, admin
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.audit import registrar_log

# Crea las tablas automáticamente (incluye AuditLog)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Turify API")

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