# Build stage - has TypeScript, tsup, etc.
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source and config files
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

# Build the project
RUN npm run build

# Production stage - minimal
FROM node:24-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S mcpcp && \
    adduser -S mcpcp -u 1001 -G mcpcp

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R mcpcp:mcpcp /app

USER mcpcp

# Default port for Streamable HTTP transport
EXPOSE 3000

# Health check using existing /health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3000/health || exit 1

# Default command
CMD ["node", "dist/cli.js"]
