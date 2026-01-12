# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for both backend and frontend
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies (including frontend via postinstall)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY frontend/ ./frontend/

# Build backend and frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (skip postinstall for prod)
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
