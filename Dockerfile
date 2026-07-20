# ── Stage 1: Dependencies ──
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (set via docker build --build-arg)
ARG MEDUSA_BACKEND_URL=http://medusa:9000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_KEY
ARG NEXT_PUBLIC_DEFAULT_REGION=dk
ARG NEXT_PUBLIC_BRAND_NAME=10SHRTS
ARG NEXT_PUBLIC_BRAND_COLOR=#ed1d27
ARG NEXT_PUBLIC_LOGO_URL=/images/10shirt-logo.png

ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY
ENV NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_BRAND_COLOR=$NEXT_PUBLIC_BRAND_COLOR
ENV NEXT_PUBLIC_LOGO_URL=$NEXT_PUBLIC_LOGO_URL

RUN npm run build

# ── Stage 3: Production ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system nextjs && adduser --system --ingroup nextjs nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

USER nextjs

CMD ["node", "server.js"]
