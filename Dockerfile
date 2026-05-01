# syntax=docker/dockerfile:1.7

FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
  PORT=3001 \
  DATA_DIR=/data \
  UPLOAD_DIR=/data/uploads \
  ENABLE_PUBLIC_DASHBOARD_TUNNEL=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --create-home nodejs \
  && mkdir -p /data/uploads \
  && chown -R nodejs:nodejs /app /data
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev \
  && npm install tsx \
  && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
USER nodejs
EXPOSE 3001
VOLUME ["/data"]
CMD ["npx", "tsx", "server/index.ts"]
