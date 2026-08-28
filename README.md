# Turify — Plataforma de Negociación de Transporte

> Conectamos pasajeros y conductores con tarifas justas, negociadas en tiempo real.

---

## Descripción

Turify es una aplicación web que permite a los pasajeros publicar solicitudes de viaje y recibir ofertas de conductores verificados. Ambas partes pueden negociar el precio mediante un sistema de contraofertas en tiempo real, hasta llegar a un acuerdo justo.

## Equipo

| Nombre | Rol |
|--------|-----|
| David Alejandro Gómez | Desarrollador Full Stack |
| Kevin Alejandro Cañas | Desarrollador Frontend |
| Jacobo Giraldo Ríos | Desarrollador Backend |

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Base de Datos | MySQL |
| Almacenamiento | Cloudinary |
| Geocodificación | Geoapify |
| Rutas | OpenRouteService |
| Autenticación | JWT (jose) |

---

## Instalación y Ejecución

### Prerrequisitos
- Python 3.10+
- Node.js 18+
- MySQL 8.0+

### Backend

```bash
cd turify-backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Crea un archivo `.env` en `turify-backend/` con:

```env
SECRET_KEY=tu_clave_secreta
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
DATABASE_URL=mysql+pymysql://usuario:password@localhost/turify_db
```

### Frontend

```bash
cd turify-frontend
npm install
npm run dev
```

Crea un archivo `.env` en `turify-frontend/` con:

```env
VITE_GEOAPIFY_API_KEY=tu_api_key
VITE_ORS_API_KEY=tu_api_key
```

### Base de Datos

```sql
CREATE DATABASE turify_db;
```

El backend crea las tablas automáticamente al iniciar.

---

## 📡 API REST

Con el backend corriendo, la documentación interactiva está disponible en:

```
http://localhost:8000/docs
```

---

## Estructura del Proyecto

```
Turify/
├── turify-backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── drivers.py
│   │   │   ├── service_requests.py
│   │   │   └── admin.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── audit.py
│   │   ├── database.py
│   │   └── main.py
│   └── requirements.txt
└── turify-frontend/
    └── src/
        ├── Dashboard.jsx
        ├── PanelConductor.jsx
        ├── AdminConductores.jsx
        ├── AdminLogs.jsx
        ├── FormularioConductor.jsx
        ├── PerfilDrawer.jsx
        ├── Login.jsx
        ├── Registro.jsx
        ├── AuthContext.jsx
        ├── AuthProvider.jsx
        ├── Toast.jsx
        └── App.jsx
```

---

## Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| `PASSENGER` | Crea viajes, recibe y negocia ofertas |
| `DRIVER` | Ve solicitudes, envía y negocia ofertas, conduce |
| `ADMIN` | Verifica documentos, consulta logs de auditoría |

---

## Funcionalidades Implementadas

- Registro y autenticación con JWT
- Publicación de solicitudes de viaje con mapa interactivo
- Sistema de ofertas y contraofertas en tiempo real
- Verificación de documentos de conductores (panel admin)
- Registro de ocupantes del viaje (FUEC simulado)
- Notificaciones en tiempo real (polling)
- Registro de auditoría de todas las acciones
- Gestión del ciclo de vida del viaje (PENDING → ASSIGNED → IN_PROGRESS → COMPLETED)

---

## Licencia

Proyecto académico — Universidad Pascual Bravo, 2026.




PASOS

1. ABRA MYSQL Y VERIFICAR QUE ESTE CONECTADO O EN LINEA

2. EN LA CARPETA BACKEND HAY UN ARCHIVO LLAMADO "Requeriments" PREGUNTELE
A GPT COMO SE EJECUTA PARA QUE SE DESCARGUEN LAS LIBRERIAS NECESARIAS

3. EN LA CARPETA FRONTEND HAY DEPENDENCIAS DE NOJE.JS QUE SE DEBEN DESCARGAR
Y NO SE CUALES SON, PREGUNTELE A GPT

4. VERIFIQUE LOS PUERTOS DE LAS BASE DE DATOS Y EL BACKEND, PERO CREO QUE NO ES NECESARIO

5. INICIE EL BACKEND CON ESTE COMANDO EN EL CMD Y VERIFIQUE QUE LA CONSOLA ESTE EN LA CARPETA
DEL BACKEND 
.\venv\Scripts\activate
"uvicorn app.main:app --reload"

6. OPCIONAL http://127.0.0.1:8000/docs ENTRE A ESE ENLACE PARA VER SU API, PERO NO ES NECESARIO

7. INICIE EL FRONTEND CON ESTE COMANDO "npm run dev", VERIFIQUE QUE ESTE EN LA CARPETA DEL FRONTEND EN LA CONSOLA. 
LA CONSOLA LE DEBE SOLTAR UN PUERTO O LINK, INGRESE Y AHI ESTA LA PAGINA

8. VERIFIQUE LA BASE DE DATOS LOS CAMBIOS, SINO DIO REZE Y PREGUNTELE A GPT

9. Instalar cloudinary: pip install cloudinary python-dotenv python-multipart
instalar tambien pip install httpx

10. Encender Ngrok en el backend para habilitar conexion con frontend, mantener ngrok y API activos al mismo tiempo:
./ngrok config add-authtoken 3CgfsC42rKAiigT15vRo81NNXXT_3FRPXTMTa1SizEHNegGAi
./ngrok http 8000


11. Push al frontend:
# 1. Asegura que estás en la rama principal
git checkout feat/frontend-auth

# 2. Verifica qué archivos fueron modificados
git status

# 3. Agrega todos los archivos cambiados al área de preparación
git add .

# 4. Crea el commit con un mensaje claro
git commit -m "feat: integrar OpenRouteService y restaurar función de creación de viajes"

git push origin feat/frontend-auth

DOCKER:

# Levantar todo
docker-compose up

# Levantar en background (sin bloquear la terminal)
docker-compose up -d

# Detener todo
docker-compose down

# Ver logs del backend
docker-compose logs backend

# Reconstruir cuando cambias código
docker-compose up --build