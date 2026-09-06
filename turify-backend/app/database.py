import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = (
    os.getenv("SUPABASE_DB_URL") or
    os.getenv("SQLALCHEMY_DATABASE_URL") or
    "postgresql://postgres:1234@localhost:5432/turify_db"
)

# Convertir postgres:// a postgresql:// si es necesario
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# HU seguridad (OWASP A01) - las politicas RLS de Postgres necesitan saber
# quien es el usuario actual en cada transaccion (lo deja guardado en
# session.info app.security.get_current_user). Este listener lo reaplica
# cada vez que la sesion abre una transaccion nueva -- pasa varias veces por
# request en los endpoints que hacen mas de un db.commit().
@event.listens_for(SessionLocal, "after_begin")
def _aplicar_contexto_rls(session, transaction, connection):
    user_id = session.info.get('rls_user_id')
    role = session.info.get('rls_role')
    if user_id is not None:
        connection.execute(text("SET LOCAL app.current_user_id = :v"), {"v": str(user_id)})
    if role is not None:
        connection.execute(text("SET LOCAL app.current_user_role = :v"), {"v": role})


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()