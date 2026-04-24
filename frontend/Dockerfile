# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /build/dist /usr/share/nginx/html

# nginx config that routes /sessions API calls to the backend and serves the SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
