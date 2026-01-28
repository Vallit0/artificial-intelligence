# ============================================
# Dockerfile para proyecto unificado (Frontend + Backend)
# ============================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy frontend package files
COPY package*.json ./
COPY bun.lockb* ./
RUN npm install --legacy-peer-deps

# Copy frontend source and build
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

# Copy backend package files
COPY server/package*.json ./
RUN npm install

# Copy backend source and build
COPY server/ .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies for backend only
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy built backend
COPY --from=backend-builder /app/server/dist ./dist

# Copy built frontend to serve as static files
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy database schema for reference
COPY server/src/db/schema.sql ./schema.sql

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
