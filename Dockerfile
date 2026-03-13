# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies including tsx
RUN npm ci --only=production && npm install tsx

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server files
COPY --from=builder /app/server ./server

# Copy database
COPY --from=builder /app/server/data.db ./

# Create uploads directory
RUN mkdir -p uploads && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Start command
ENV NODE_ENV=production
CMD ["npx", "tsx", "server/index.ts"]
