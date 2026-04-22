from app.routers import auth, drivers, service_requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth
from app.database import engine, Base

# Creates the tables in MySQL automatically if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Turify API")

# Configuración de CORS
origins = [
    "http://localhost:3000", # URL común de React
    "http://localhost:5173", # URL común de Vite
    "*",                     # Esto permite CUALQUIER origen (útil para pruebas iniciales)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción se cambian los "" por la URL exacta de tu frontend (ej. localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Include the authentication router
app.include_router(auth.router)
app.include_router(drivers.router)
app.include_router(service_requests.router)