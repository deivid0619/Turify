# CI/CD con GitHub Actions — pasos pendientes de tu lado

El workflow ya está en `.github/workflows/ci-cd.yml`. Corre automáticamente
en cada push o pull request contra `main`: primero los tests de backend
(pytest contra un Postgres real levantado dentro del workflow), luego los
tests de frontend (vitest) y el build de producción (`vite build`). Si push
fue a `main` y ambos pasan, dispara el deploy en Render **y en paralelo**
construye y publica las imágenes Docker de backend y frontend en Docker Hub.

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

---

## 4. Docker Hub — para que tu profesor pueda ver el proyecto

Esto también lo tenés que hacer vos: crear la cuenta y los tokens implica
tus propias credenciales, así que no puedo hacerlo por vos. Son ~10 minutos.

### 4.1 Crear la cuenta (gratis)

1. Andá a [hub.docker.com](https://hub.docker.com) y creá una cuenta
   gratuita (con tu correo o con GitHub).
2. Anotá el **nombre de usuario** que elegiste — lo vas a necesitar en el
   paso 4.3. No hace falta crear los repositorios `turify-backend` /
   `turify-frontend` a mano: Docker Hub los crea solos la primera vez que
   el workflow les hace push.

### 4.2 Generar un Access Token (no uses tu contraseña)

1. En Docker Hub: **Account Settings → Personal access tokens → Generate
   new token**.
2. Ponele un nombre descriptivo, por ejemplo `github-actions-turify`.
3. Permisos: **Read & Write** (necesita poder subir imágenes).
4. Copiá el token que te muestra — solo se ve una vez.

### 4.3 Guardar usuario y token en GitHub

En el repo de GitHub, **Settings → Secrets and variables → Actions**:

1. Pestaña **Variables** → **New repository variable**:
   - Nombre: `DOCKERHUB_USERNAME`
   - Valor: tu nombre de usuario de Docker Hub (del paso 4.1)

   (Va como *variable*, no como *secret*, porque el nombre de usuario no es
   información sensible — el workflow lo usa para armar el nombre de la
   imagen, ej. `tuusuario/turify-backend`.)

2. Pestaña **Secrets** → **New repository secret**:
   - Nombre: `DOCKERHUB_TOKEN`
   - Valor: el access token del paso 4.2

(Los nombres deben ser exactos — el workflow los busca por ese nombre.)

### 4.4 Verificar que quedaron públicos

Después del primer push a `main` que dispare el workflow, entrá a
`hub.docker.com/r/TU_USUARIO/turify-backend` y
`hub.docker.com/r/TU_USUARIO/turify-frontend` y confirmá que digan
**Public** (así puede verlos cualquiera con el link, sin iniciar sesión).
Si por algún motivo aparecen como *Private*, hay un botón **Make public**
en la misma página del repositorio.

### 4.5 El link para tu profesor

Una vez publicado, el link que le podés pasar es directamente:

- `https://hub.docker.com/r/TU_USUARIO/turify-backend`
- `https://hub.docker.com/r/TU_USUARIO/turify-frontend`

Ahí va a poder ver las imágenes, sus tags (`latest` y uno por cada commit,
identificado con el hash del commit) y el Dockerfile de cada una.

## Cómo subir todo esto

Yo no hago `git push` en ningún caso. Cuando quieras subir los cambios que
dejé en tu repo (el workflow actualizado con el job de Docker Hub), corré
vos mismo desde tu máquina:

```
git add .
git commit -m "SCRUM-192/193: publicar imágenes en Docker Hub desde CI/CD"
git push origin main
```

Con eso el workflow correrá automáticamente en GitHub. Podés ver el
resultado en la pestaña **Actions** del repo — el job nuevo se llama
**"Publicar imágenes en Docker Hub"**. Ojo: hasta que completes los pasos
4.1–4.3, ese job va a fallar en el login de Docker Hub (es esperable,
mientras tanto los demás jobs — tests y deploy en Render — siguen
funcionando igual).
