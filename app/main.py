from app.routers import auth, drivers, service_requests, admin
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base

# Creates the tables in MySQL automatically if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Turify API")

# Configuración de CORS
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "*",
]

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