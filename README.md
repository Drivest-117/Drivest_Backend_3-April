# Route Master Backend

Node.js 20 + NestJS API for the Route Master mobile app. Implements driving test centres, routes, entitlement gating, cashback, and RevenueCat webhooks.

## Stack
- NestJS (TypeScript)
- PostgreSQL 15 + PostGIS, TypeORM migrations
- Redis (optional, included in docker compose)
- JWT auth (bcrypt password hashing)
- Swagger auto-generated at `/docs`

## Quickstart
1. Copy env and adjust secrets:
   ```bash
   cp .env.example .env
   ```
2. Start infrastructure + API (hot reload):
   ```bash
   docker compose up --build
   ```
3. Install deps (if running locally):
   ```bash
   npm install
   ```
4. Run migrations:
   ```bash
   npm run migration:run
   ```
5. Seed demo data (10 centres, 3 routes each, products):
   ```bash
   npm run seed
   ```
6. Run tests:
   ```bash
   npm test
   ```
7. Start dev server outside docker (optional):
   ```bash
   npm run start:dev
   ```

## Important Commands
- `npm run migration:generate` – generate new migration
- `npm run migration:run` – run migrations (uses `DATABASE_URL`)
- `npm run seed` – seed demo data

## Business Logic Notes
- Route access requires either an active subscription (GLOBAL entitlement) or a purchased centre pack entitlement.
- Subscriptions expire immediately at `endsAt`.
- Practice finish increments `RouteStat.timesCompleted` and keeps best time.
- Cashback can be started once per user; submission auto-approves unless basic fraud checks flag it as suspicious (then stays `PENDING`).
- Account delete anonymizes user data and soft deletes.
- RevenueCat webhook is HMAC-validated (`x-revenuecat-signature`) and idempotent by `transactionId`.

## API Overview
- `GET /health`
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /v1/auth/sign-up`, `POST /v1/auth/sign-in`, `POST /v1/auth/forgot-password`, `POST /v1/auth/reset-password`
- Account: `GET /me`, `GET /v1/me`, `PATCH /me`, `PATCH /v1/me`, `PATCH /me/consents`, `PATCH /v1/me/consents`, `PATCH /me/push-token`, `PATCH /v1/me/push-token`, `DELETE /me`, `DELETE /v1/me`
- Centres: `GET /centres?query=&near=lat,lng&radiusKm=&page=&limit=`, `GET /centres/:id`, `GET /centres/:id/routes`
- Routes (auth + entitlement): `GET /routes/:id`, `GET /routes/:id/download`, `POST /routes/:id/practice/start`, `POST /routes/:id/practice/finish`
- Entitlements: `GET /entitlements`
- Cashback: `POST /cashback/start`, `POST /cashback/submit`, `GET /cashback/status`
- Webhooks: `POST /webhooks/revenuecat`
- Parking: `GET /v1/parking/search`, `GET /v1/parking/councils`, `GET /v1/parking/spot/:id`
- Notifications: `GET /v1/notifications/my`, `PATCH /v1/notifications/:id/read`, `POST /v1/notifications/read-all`

## Curl Examples
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"password","name":"Me"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"me@example.com","password":"password"}' | jq -r '.data.accessToken')

# List centres near a point
curl "http://localhost:3000/centres?near=51.5,-0.1&radiusKm=20" -H "Authorization: Bearer $TOKEN"

# Start cashback
curl -X POST http://localhost:3000/cashback/start -H "Authorization: Bearer $TOKEN"
```

## Assumptions
- RevenueCat webhook payload contains `product_id`, `transaction_id`, `app_user_id`, `purchased_at`, and `expiration_at` fields; signature is HMAC-SHA256 over the JSON body.
- For tests, SQLite is used with simplified geo storage; production uses PostGIS via migrations.
- Redis is available if you want to add caching/rate limits later (container included but not required).
- When running the API outside docker against the dockerized Postgres, change `DATABASE_URL` host to `localhost`.\n

## EC2 Deployment

The backend now includes an EC2-oriented deployment path:

- local deploy script: [`scripts/deploy_ec2.sh`](./scripts/deploy_ec2.sh)
- PM2 runtime config: [`ecosystem.config.cjs`](./ecosystem.config.cjs)
- GitHub Actions workflow: [`.github/workflows/deploy-ec2.yml`](./.github/workflows/deploy-ec2.yml)
- setup guide: [`EC2-DEPLOY.md`](./EC2-DEPLOY.md)

The deploy flow is: install dependencies, build, run migrations, then `pm2 startOrReload ecosystem.config.cjs`.
