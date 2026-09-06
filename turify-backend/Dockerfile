# ── Backend Turify — FastAPI ─────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 8000

# Comando de inicio
# Usa el puerto que asigne la plataforma (Render/Railway) via $PORT,
# o 8000 si corre localmente en Docker Compose (que no define $PORT).
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
