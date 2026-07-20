# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --legacy-peer-deps

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
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src

# Admin bundler expects admin at .medusa/server/admin/ but build puts it at .medusa/server/public/admin/
RUN ln -sf /app/.medusa/server/public/admin /app/.medusa/server/admin

# Medusa V2 serves the admin dashboard from the same process
EXPOSE 9000

# Run as root — medusa user doesn't have access to built admin output
# USER medusa

CMD ["npx", "medusa", "start"]
