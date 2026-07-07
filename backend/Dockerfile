# ---------- Stage 1: build ----------
FROM node:22-slim AS builder
WORKDIR /app

# openssl: evita el warning de Prisma al generar el cliente
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Instalar todas las deps (incluye devDeps: nest-cli, typescript) para poder buildear
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el código y generar el cliente Prisma + compilar
COPY . .
RUN npx prisma generate
RUN npm run build
# nest build emite dist/src (app), dist/prisma (seed compilado) y dist/generated
# (cliente Prisma compilado, importado por la app en runtime).

# ---------- Stage 2: runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# openssl: evita el warning de Prisma al correr `db push` en el arranque
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Solo deps de producción (prisma CLI queda: está en dependencies, sirve para db push)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Artefactos compilados + schema/config necesarios para `prisma db push`
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

# Healthcheck contra el endpoint real (Node 22 trae fetch global)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Default prod-safe: solo arranca la app (NO toca el schema de la base).
# El docker-compose de dev sobreescribe el command para hacer db push + seed.
CMD ["node", "dist/src/main.js"]
