# CI/CD con GitHub Actions — pasos pendientes de tu lado

El workflow ya está en `.github/workflows/ci-cd.yml`. Corre automáticamente
en cada push o pull request contra `main`: primero los tests de backend
(pytest contra un Postgres real levantado dentro del workflow), luego los
tests de frontend (vitest) y el build de producción (`vite build`). Si push
fue a `main` y ambos pasan, dispara el deploy en Render.

Para que la parte de deploy funcione necesitás completar estos 3 pasos —
ninguno lo puedo hacer yo por vos porque implican tu cuenta de Render y tus
credenciales:

## 1. Generar un Deploy Hook por cada servicio en Render

1. Entrá al dashboard de Render → abrí el servicio del **backend**.
2. Ve a **Settings → Deploy Hook** y copiá la URL que te da (algo como
   `https://api.render.com/deploy/srv-xxxxx?key=yyyyy`).
3. Repetí lo mismo con el servicio del **frontend**.

## 2. Guardar esas URLs como Secrets en GitHub

1. En el repo de GitHub: **Settings → Secrets and variables → Actions →
   New repository secret**.
2. Creá un secreto llamado `RENDER_BACKEND_DEPLOY_HOOK` con la URL del
   backend.
3. Creá otro llamado `RENDER_FRONTEND_DEPLOY_HOOK` con la URL del frontend.

(Los nombres deben ser exactos — el workflow los busca por ese nombre.)

## 3. Desactivar el Auto-Deploy nativo de Render

Por defecto Render redeploya solo cuando detecta un push a la rama
conectada. Si dejás eso prendido junto con el nuevo workflow, cada push
dispararía el deploy dos veces (una vez por Render mismo, otra por GitHub
Actions).

En cada servicio (backend y frontend): **Settings → Build & Deploy → Auto-
Deploy → Off**. A partir de ahí el único disparador del deploy es el
workflow de GitHub Actions, y solo se dispara si los tests pasaron.

## Notificación de fallos

No hace falta configurar nada más para esto. GitHub ya te manda un correo
automáticamente cuando un workflow de un repo tuyo falla — se controla en
tu cuenta de GitHub, en **Settings → Notifications → Actions**. No se usó
SMTP ni ningún secreto adicional para esto a propósito, para no tener que
manejar una credencial de correo.

## Cómo subir todo esto

Yo no hago `git push` en ningún caso. Cuando quieras subir los cambios que
dejé en tu repo (los tests de backend/frontend y el workflow), corré vos
mismo desde tu máquina:

```
git add .
git commit -m "SCRUM-192/193: CI/CD con GitHub Actions + tests automatizados"
git push origin main
```

Con eso el workflow correrá automáticamente en GitHub. Podés ver el
resultado en la pestaña **Actions** del repo.
