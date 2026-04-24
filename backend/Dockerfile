# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .

# Compile NestJS app + standalone bot script
RUN npm run build


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Use the official Playwright image so Chromium and all its dependencies
# (Xvfb, fonts, audio libs) are pre-installed.
FROM mcr.microsoft.com/playwright:v1.50.1-noble AS runtime

WORKDIR /app

# Copy compiled output and production dependencies from the builder
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package*.json ./

RUN npm ci --omit=dev

# Install PulseAudio so Chromium has a virtual audio sink inside the container
RUN apt-get update && apt-get install -y --no-install-recommends \
      pulseaudio \
      xvfb \
    && rm -rf /var/lib/apt/lists/*

# Download Playwright's managed Chromium browser
RUN npx playwright install chromium

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main"]
