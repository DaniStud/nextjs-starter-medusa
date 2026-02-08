# Local Setup — NextJS + Medusa (Quick Start)

This file describes the minimal steps to run the project locally for development.

Prerequisites
- Docker Desktop (or Colima + Docker)
- Node.js >= 20
- Git

Quick Start
1. Start Docker
   - Open Docker Desktop and wait until it reports "Docker Desktop is running".

2. Start Postgres and Redis
```bash
cd medusa-backend
docker compose up -d
```

3. Start Medusa backend
```bash
cd medusa-backend/my-medusa-store
npm install /* IF FIRST TIME */

npm run dev
```
- Backend URL: http://localhost:9000
- Admin UI: http://localhost:9000/app

––IF FIRST TIME ––
4. Seed demo data (creates products, regions, and the publishable API key)
```bash
cd medusa-backend/my-medusa-store
npm run seed
```
––IF FIRST TIME ––
5. Create admin user
```bash
cd medusa-backend/my-medusa-store
npx medusa user -e admin@example.com -p supersecret
```
- Login: Email `admin@example.com` / Password `supersecret`

––IF FIRST TIME ––
6. Configure storefront env
- Edit `medusa-backend/my-medusa-store-storefront/.env.local` and set:
```
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<publishable_key>
NEXT_PUBLIC_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_REGION=us
REVALIDATE_SECRET=supersecret
```
- Get the publishable key:
  - Open Admin → Settings → API Keys and copy the publishable key (recommended), OR
  - From your host:
  ```bash
  cd medusa-backend
  docker compose exec -T postgres psql -U medusa -d medusa -c "SELECT token FROM api_key WHERE type='publishable';"
  ```

7. Start storefront
```bash
cd medusa-backend/my-medusa-store-storefront
npm install /* IF FIRST TIME */
npm run dev
```
- Storefront: http:// localhost:8000

Stopping the stack
```bash
cd medusa-backend
docker compose down
# then stop dev terminals (Ctrl+C) as needed
```

Troubleshooting
- `docker: command not found` — install Docker Desktop or Colima:
  - Docker Desktop: `brew install --cask docker` then open Docker.app
  - Colima + docker CLI: `brew install colima docker && colima start`

- `A valid publishable key is required` (storefront)
  - Ensure `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` in `my-medusa-store-storefront/.env.local` matches the database/Admin key and restart the dev server.

- `npm install` appears stuck
  - Re-run verbose: `npm install --loglevel silly --no-audit --no-fund`
  - Check logs: `tail -n 200 ~/.npm/_logs/*-debug-*.log`

- Git push fails with HTTP 403
  - Ensure you are authenticated to the correct remote account, refresh PAT or use SSH. See project notes or run:
  ```bash
  GIT_TRACE=1 GIT_CURL_VERBOSE=1 git push origin your-branch
  ```

Summary (terminals)
- Terminal 1 (Docker): `docker compose up -d` (in `medusa-backend`)
- Terminal 2 (Backend): `npm run dev` (in `medusa-backend/my-medusa-store`) → http://localhost:9000
- Terminal 3 (Storefront): `npm run dev` (in `medusa-backend/my-medusa-store-storefront`) → http://localhost:8000

If you want, I can commit this README and push it for you (I will not push any secrets).