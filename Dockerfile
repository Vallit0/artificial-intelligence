# ============================================
# Dockerfile para proyecto unificado (Frontend + Backend)
# ============================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Harden npm against flaky/slow network (ETIMEDOUT en registry.npmjs.org)
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000

# Copy frontend package files
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy frontend source and build
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

# Harden npm against flaky/slow network (ETIMEDOUT en registry.npmjs.org)
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000

# Copy backend package files
COPY server/package*.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./prisma.config.ts
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Copy backend source and build
COPY server/ .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

# Harden npm against flaky/slow network (ETIMEDOUT en registry.npmjs.org)
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000

# Install production dependencies for backend
COPY server/package*.json ./
RUN npm install --omit=dev && npm install -g tsx

# Copy Prisma schema and generate client for production
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./prisma.config.ts
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Copy built backend
COPY --from=backend-builder /app/server/dist ./dist

# Copy built frontend to serve as static files
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy public audio files
COPY public/audio ./audio

# Copy seed file for initial data
COPY server/prisma/seed.ts ./prisma/seed.ts

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server only. Schema migrations and seeding are NO LONGER run here:
# with multiple replicas this command would race N times on boot and the old
# `prisma db push --accept-data-loss` could silently drop data. Migrations now
# run once via the dedicated `migrate` one-shot service in docker-compose.prod.yml
# (`npx prisma migrate deploy` + idempotent seed). See infra/RUNBOOK.md.
CMD ["node", "dist/index.js"]
