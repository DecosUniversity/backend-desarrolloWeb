# Local setup & run (Backend)

This file documents the minimal commands to run the Backend and workers locally (Windows - PowerShell).

Prerequisites

- Node.js (16+) and npm
- Docker (recommended) to run Redis via docker-compose
- A MySQL server (local, WSL, or container). The project reads `DATABASE_URL` from `.env`.

Quick steps

1. Copy `.env.example` to `.env` and edit values (DATABASE_URL, JWT secrets, REDIS_URL, SMTP if needed):

```powershell
Copy-Item .env.example .env
# open .env and edit values
```

2. Install dependencies:

```powershell
npm install
```

3. Generate Prisma client and apply migrations (after setting DATABASE_URL):

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

4. (Optional) seed sample data:

```powershell
npm run seed
```

Start Redis (recommended)

```powershell
cd "C:\Users\DCorn\Desktop\Desarrollo Web\Proyecto\Backend"
docker compose up -d
```

Start server and workers

- Start API server only (useful for development when you don't need workers):

```powershell
npm run dev
```

- Start server together with workers (recommended for end-to-end local testing):

```powershell
npm run start:all
```

Notes

- `npm run start:all` runs `src/index.js` which imports/starts the workers and then the Express server. Use this when you want queues to be processed locally.
- If jobs are being created but not processed, ensure `npm run start:all` is used or launch specific worker files manually.

Useful admin endpoints

- `GET /admin/queues` — list known queue names
- `GET /admin/queues/:name/counts` — job counts per status for `:name`
- `GET /admin/queues/:name/jobs?status=waiting&page=0&pageSize=10` — list jobs

Troubleshooting

- If `npm run start:all` exits with an error, check:
  - Redis is running (`docker compose ps` or `redis-cli ping`)
  - MySQL is reachable and `DATABASE_URL` is correct
  - Check the server logs for stack traces

If you want, I can add these commands to the main `README.md` instead of a separate file, or add a `make`/PowerShell script to run the common tasks.
