# Multi-stage build for better optimization
FROM node:20.20.0-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20.20.0-slim AS production

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/build ./build

# Copy other necessary files
COPY medusa-config.ts ./
COPY --from=base /app/node_modules/@medusajs ./node_modules/@medusajs

# Create a non-root user
RUN groupadd -r medusa && useradd -r -g medusa medusa
RUN chown -R medusa:medusa /app
USER medusa

# Expose port
EXPOSE 9000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# Start the application
CMD ["npm", "run", "start"]
