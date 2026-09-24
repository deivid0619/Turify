# Turify

Plataforma de transporte especial e intermunicipal para Antioquia — conecta
pasajeros con conductores afiliados a empresas de transporte habilitadas.

## Correr el proyecto en local

No hace falta Docker para desarrollar — el backend habla directo con
Supabase (nube), así que alcanza con Python y Node instalados.

### Backend

```
cd turify-backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

`Activate.ps1` es para PowerShell — el prompt te va a mostrar `(venv)` al
activarse. El `pip install` es solo por si `requirements.txt` cambió desde
la última vez; si no, se puede saltar. Para salir del entorno: `deactivate`.

Con eso el backend queda arriba en `http://localhost:8001` (la documentación
interactiva está en `http://localhost:8001/docs`).

### Frontend

En otra terminal (no necesita entorno virtual):

```
cd turify-frontend
npm run dev
```

Abre la app en `http://localhost:5180`. El `.env` del frontend ya apunta a
`http://127.0.0.1:8001` como backend, así que no hace falta tocar nada más.

## Despliegue y CI/CD

El despliegue a producción (Render) y la publicación de imágenes en Docker
Hub corren automáticamente por GitHub Actions en cada push a `main` — ver
[`README-CI-CD.md`](./README-CI-CD.md) para la configuración de esa parte.
