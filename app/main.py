from fastapi import FastAPI
from app.routers import auth
from app.database import engine, Base

# Creates the tables in MySQL automatically if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Turify API")

# Include the authentication router
app.include_router(auth.router)