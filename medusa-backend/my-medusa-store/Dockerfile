FROM node:20.20.0-slim

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install all dependencies first (needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Create medusa user
RUN groupadd -r medusa && useradd -r -g medusa medusa
RUN chown -R medusa:medusa /app
USER medusa

# Expose port
EXPOSE 9000

# Start application
CMD ["npm", "run", "start"]
CMD ["npm", "run", "start"]
