# ── Frontend Turify — React/Vite ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código y construir
COPY . .
RUN npm run build

# ── Servidor de producción con Nginx ─────────────────────────────────────────
FROM nginx:alpine

# Copiar build de Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de Nginx para React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
