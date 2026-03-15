# ── Stage 1: Build ──────────────────────────────────────────────────────────────
FROM node:24-slim AS build
WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Stage 2: Production Runtime ─────────────────────────────────────────────────
FROM node:24-slim AS runtime
WORKDIR /app

# Install ffmpeg for audio extraction from video uploads
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json package-lock.json ./
# --ignore-scripts: skips husky prepare hook (devDep not present)
# sharp uses optionalDependencies for prebuilt binaries, not install hooks
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output and static assets
COPY --from=build /app/dist/ dist/
COPY public/ public/

# Cloud Run injects PORT; default to 3000 for local dev
ENV PORT=3000
EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Run as non-root for security
USER node

CMD ["node", "dist/index.js"]
