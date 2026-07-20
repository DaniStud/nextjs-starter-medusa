# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npx medusa build

# ── Stage 2: Production ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system medusa && adduser --system --ingroup medusa medusa

# Copy built output from builder
COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/medusa-config.ts ./medusa-config.ts

# Medusa V2 serves the admin dashboard from the same process
EXPOSE 9000

USER medusa

CMD ["npx", "medusa", "start"]
