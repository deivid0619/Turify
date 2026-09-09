# ── Frontend Turify — sirve el build de Vite ya generado ────────────────────
# NOTA: este Dockerfile YA NO compila el proyecto adentro del contenedor.
# En esta máquina, correr Vite dentro de Docker/WSL2 crashea con SIGBUS
# (probado con varias versiones de Vite, caché limpio y WSL2 reiniciado —
# el mismo build funciona bien corrido directo en Windows). Por eso el
# flujo pasó a ser: compilar en el host, después construir la imagen.
#
# Antes de "docker compose build frontend", corré en esta carpeta:
#   npm install
#   npm run build
# Eso genera la carpeta dist/ que este Dockerfile copia tal cual.

FROM nginx:alpine

# Copiar el build de Vite ya generado en el host.
COPY dist /usr/share/nginx/html

# Configuración de Nginx para React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
