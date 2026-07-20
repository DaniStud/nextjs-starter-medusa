#!/bin/bash
# =============================================================================
# add-tenant.sh — Provision a new tenant on the Hetzner VPS
# =============================================================================
# Usage:
#   ./scripts/add-tenant.sh <slug> <domain> [brand_color] [brand_name]
#
# Example:
#   ./scripts/add-tenant.sh coolshirts coolshirts.dk "#0066cc" "Cool Shirts"
#
# This script:
#   1. Creates a PostgreSQL database for the tenant
#   2. Generates a .env.{slug} file from the template
#   3. Creates a docker-compose.tenant-{slug}.yml override file
#   4. Builds and starts the tenant containers
#   5. Runs Medusa database migrations
# =============================================================================

set -euo pipefail

SLUG="${1:?Usage: $0 <slug> <domain> [brand_color] [brand_name]}"
DOMAIN="${2:?Usage: $0 <slug> <domain> [brand_color] [brand_name]}"
BRAND_COLOR="${3:-#ed1d27}"
BRAND_NAME="${4:-$SLUG}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.${SLUG}"
COMPOSE_OVERRIDE="$PROJECT_DIR/docker-compose.tenant-${SLUG}.yml"

# Validate slug (alphanumeric + hyphens only)
if [[ ! "$SLUG" =~ ^[a-z0-9-]+$ ]]; then
  echo "ERROR: Slug must be lowercase alphanumeric with hyphens only."
  exit 1
fi

echo "=== Provisioning tenant: $SLUG ==="
echo "  Domain:      $DOMAIN"
echo "  Brand Color: $BRAND_COLOR"
echo "  Brand Name:  $BRAND_NAME"
echo ""

# ── Step 1: Create database ──
echo "[1/5] Creating database db_${SLUG}..."
# Read postgres password from the main .env or docker-compose
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD env var}"
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
  psql -U "${POSTGRES_USER:-medusa}" -c "CREATE DATABASE db_${SLUG};" 2>/dev/null || \
  echo "  Database db_${SLUG} already exists, skipping."

# ── Step 2: Generate .env file ──
echo "[2/5] Generating $ENV_FILE..."
if [ -f "$ENV_FILE" ]; then
  echo "  .env file already exists, skipping. Edit manually if needed."
else
  JWT_SECRET=$(openssl rand -hex 32)
  COOKIE_SECRET=$(openssl rand -hex 32)

  cp "$SCRIPT_DIR/tenant.env.template" "$ENV_FILE"

  # Replace placeholders
  sed -i "s|TENANT_SLUG=example|TENANT_SLUG=${SLUG}|g" "$ENV_FILE"
  sed -i "s|TENANT_DOMAIN=example.com|TENANT_DOMAIN=${DOMAIN}|g" "$ENV_FILE"
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" "$ENV_FILE"
  sed -i "s|COOKIE_SECRET=.*|COOKIE_SECRET=${COOKIE_SECRET}|g" "$ENV_FILE"
  sed -i "s|db_example|db_${SLUG}|g" "$ENV_FILE"
  sed -i "s|STORE_CORS=.*|STORE_CORS=https://${DOMAIN}|g" "$ENV_FILE"
  sed -i "s|ADMIN_CORS=.*|ADMIN_CORS=https://admin.${DOMAIN}|g" "$ENV_FILE"
  sed -i "s|AUTH_CORS=.*|AUTH_CORS=https://admin.${DOMAIN}|g" "$ENV_FILE"
  sed -i "s|NEXT_PUBLIC_BRAND_NAME=.*|NEXT_PUBLIC_BRAND_NAME=${BRAND_NAME}|g" "$ENV_FILE"
  sed -i "s|NEXT_PUBLIC_BRAND_COLOR=.*|NEXT_PUBLIC_BRAND_COLOR=${BRAND_COLOR}|g" "$ENV_FILE"
  sed -i "s|NEXT_PUBLIC_LOGO_URL=.*|NEXT_PUBLIC_LOGO_URL=/images/${SLUG}-logo.png|g" "$ENV_FILE"
  sed -i "s|MEDUSA_BACKEND_URL=.*|MEDUSA_BACKEND_URL=https://api.${DOMAIN}|g" "$ENV_FILE"
  sed -i "s|FILE_S3_PREFIX=.*|FILE_S3_PREFIX=${SLUG}/|g" "$ENV_FILE"

  echo "  Created. IMPORTANT: Edit $ENV_FILE to fill in Stripe keys and Shirtplatform credentials!"
fi

# ── Step 3: Generate docker-compose override ──
echo "[3/5] Generating $COMPOSE_OVERRIDE..."
cat > "$COMPOSE_OVERRIDE" <<YAML
# Auto-generated tenant override for: ${SLUG}
# Usage: docker compose -f docker-compose.prod.yml -f docker-compose.tenant-${SLUG}.yml up -d

services:
  medusa-${SLUG}:
    build:
      context: ./medusa-backend/my-medusa-store
      dockerfile: Dockerfile
    restart: always
    env_file: .env.${SLUG}
    environment:
      DATABASE_URL: postgresql://\${POSTGRES_USER:-medusa}:\${POSTGRES_PASSWORD}@postgres:5432/db_${SLUG}
      REDIS_URL: redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - web
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.medusa-${SLUG}.rule=Host(\`api.${DOMAIN}\`)"
      - "traefik.http.routers.medusa-${SLUG}.entrypoints=websecure"
      - "traefik.http.routers.medusa-${SLUG}.tls.certresolver=letsencrypt"
      - "traefik.http.services.medusa-${SLUG}.loadbalancer.server.port=9000"
      - "traefik.http.routers.admin-${SLUG}.rule=Host(\`admin.${DOMAIN}\`)"
      - "traefik.http.routers.admin-${SLUG}.entrypoints=websecure"
      - "traefik.http.routers.admin-${SLUG}.tls.certresolver=letsencrypt"
      - "traefik.http.services.admin-${SLUG}.loadbalancer.server.port=9000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:9000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  storefront-${SLUG}:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        MEDUSA_BACKEND_URL: https://api.${DOMAIN}
        NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: \${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY}
        NEXT_PUBLIC_STRIPE_KEY: \${NEXT_PUBLIC_STRIPE_KEY}
        NEXT_PUBLIC_DEFAULT_REGION: dk
        NEXT_PUBLIC_BRAND_NAME: "${BRAND_NAME}"
        NEXT_PUBLIC_BRAND_COLOR: "${BRAND_COLOR}"
        NEXT_PUBLIC_LOGO_URL: "/images/${SLUG}-logo.png"
    restart: always
    env_file: .env.${SLUG}
    environment:
      MEDUSA_BACKEND_URL: http://medusa-${SLUG}:9000
    depends_on:
      medusa-${SLUG}:
        condition: service_healthy
    networks:
      - web
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.storefront-${SLUG}.rule=Host(\`${DOMAIN}\`)"
      - "traefik.http.routers.storefront-${SLUG}.entrypoints=websecure"
      - "traefik.http.routers.storefront-${SLUG}.tls.certresolver=letsencrypt"
      - "traefik.http.services.storefront-${SLUG}.loadbalancer.server.port=3000"
YAML

# ── Step 4: Build and start ──
echo "[4/5] Building and starting tenant containers..."
docker compose \
  -f "$PROJECT_DIR/docker-compose.prod.yml" \
  -f "$COMPOSE_OVERRIDE" \
  up -d --build "medusa-${SLUG}" "storefront-${SLUG}"

# ── Step 5: Run migrations ──
echo "[5/5] Running Medusa database migrations..."
sleep 10  # Wait for container to start
docker compose \
  -f "$PROJECT_DIR/docker-compose.prod.yml" \
  -f "$COMPOSE_OVERRIDE" \
  exec -T "medusa-${SLUG}" npx medusa db:migrate

echo ""
echo "=== Tenant $SLUG provisioned! ==="
echo ""
echo "Next steps:"
echo "  1. Edit $ENV_FILE — fill in Stripe keys and Shirtplatform credentials"
echo "  2. Add tenant logo to public/images/${SLUG}-logo.png"
echo "  3. Point DNS for ${DOMAIN}, api.${DOMAIN}, admin.${DOMAIN} to this server's IP"
echo "  4. Create a publishable API key in the Medusa admin at https://admin.${DOMAIN}"
echo "  5. Add the key to $ENV_FILE as NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"
echo "  6. Rebuild storefront: docker compose -f docker-compose.prod.yml -f $COMPOSE_OVERRIDE up -d --build storefront-${SLUG}"
echo ""
