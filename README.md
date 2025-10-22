# Bus Reservation Backend (Express + Prisma + BullMQ)

This is a minimal backend scaffold for a bus reservation system.

Features:
- Express API
- JWT authentication with access + refresh tokens
- Prisma ORM (SQLite by default) with models for User, RefreshToken, Bus, Trip, Reservation
- BullMQ queue example (requires Redis) for processing reservations

Quick start

1. Copy `.env.example` to `.env` and adjust values.
2. Install dependencies:

```powershell
npm install
```

3. Generate Prisma client and run migration:

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

4. Docker Compose in this repository starts only `redis` (used by BullMQ). MySQL must be provided locally (native install, WSL, or another container you manage).

To start Redis with Docker Compose from the project root (PowerShell):

```powershell
docker compose up -d
```

If you have a local MySQL server already running, copy `.env.example` to `.env` and set `DATABASE_URL` to point at your local MySQL. Example for a local MySQL running on 127.0.0.1:

```powershell
Copy-Item .env.example .env
# then edit .env and set:
# DATABASE_URL="mysql://root:yourpassword@127.0.0.1:3306/bus_reservations"
```

After `.env` is configured, generate the Prisma client and run migrations against your local MySQL:

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

5. Start the worker (optional) and server in separate terminals:

```powershell
# Worker
node src/workers/reservationWorker.js

# Server
npm run dev
```

Endpoints

- POST /auth/register { email, password, name }
- POST /auth/login { email, password } -> { accessToken, refreshToken }
- POST /auth/refresh { refreshToken } -> { accessToken }
- POST /auth/logout { refreshToken }
- POST /reservations (protected) { tripId, seat } -> enqueue job
- GET /reservations (protected) -> list user's reservations

Notes and next steps

- For production use a managed DB (Postgres), rotate secrets, and secure refresh tokens storage.
- Add input validation, rate-limiting, and email notifications.
- Add unit/integration tests.
