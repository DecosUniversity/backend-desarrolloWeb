# Documentación del Backend - Sistema de Reservas de Transporte (Bus)

Esta documentación resume todo lo que se hizo en el backend: arquitectura, archivos creados/actualizados, pasos de instalación, cómo levantar servicios (MySQL local, Redis en Docker), cómo ejecutar migraciones y seed, cómo ejecutar servidor y worker, endpoints disponibles, pruebas con Postman, y resolución de problemas comunes.

---

## Resumen rápido
- Proyecto: Node.js + Express
- ORM: Prisma (MySQL en desarrollo)
- Autenticación: JWT (access + refresh tokens) con almacenamiento de refresh tokens en BD
- Colas: BullMQ (usa Redis). Implementado con fallback: si Redis no está disponible, el productor crea la reserva directamente en BD para desarrollo.

---

## Archivos importantes (nuevos / modificados)
- `package.json` — scripts (dev, start, prisma, seed) y dependencias (express, prisma, @prisma/client, mysql2, bullmq, ioredis, bcrypt, jsonwebtoken, morgan, body-parser, nodemon, etc.).
- `.env.example`, `.env` — variables de entorno (DATABASE_URL, JWT_* , REDIS_URL, PORT).
- `prisma/schema.prisma` — modelos: User, RefreshToken, Bus, Trip, Reservation.
- `prisma/seed.js` — script para poblar BD con datos iniciales.
- `prisma/` migraciones — generadas tras `prisma migrate dev`.
- `src/server.js` — servidor Express y montaje de rutas.
- `src/prismaClient.js` — exporta instancia Prisma.
- `src/routes/auth.js` — rutas `/auth` (register, login, refresh, logout).
- `src/controllers/authController.js` — lógica auth, firma JWT, almacenamiento de refresh tokens.
- `src/middleware/auth.js` — middleware que valida access token.
- `src/routes/reservations.js` — rutas protegidas de reservas (enqueue).
- `src/controllers/reservationController.js` — encola o crea reserva según configuración.
- `src/queues/reservationQueue.js` — producer BullMQ; ahora con fallback directo a BD si Redis no responde. Usa `maxRetriesPerRequest: null` en la conexión ioredis para evitar deprecations.
- `src/workers/reservationWorker.js` — worker BullMQ que procesa jobs `create-reservation`. Usa `maxRetriesPerRequest: null`.
- `src/routes/dev.js` — ruta de desarrollo `/dev/create-reservation` que crea reserva directamente (útil para pruebas sin Redis).
- `prisma/seed.js` y `scripts/` (`checkLogin.js`, `setAdminPassword.js`) — utilidades para verificar y ajustar credenciales.
- `docker-compose.yml` — simplificado: solo inicia Redis (si lo deseas usar). El proyecto permite usar Redis vía `docker run` también.

---

## Variables de entorno clave
Copiar `.env.example` a `.env` y ajustar según tu entorno. Ejemplo usado en el repo:

```
DATABASE_URL="mysql://root@127.0.0.1:3306/reservas"
JWT_ACCESS_SECRET=change_this_access_secret
JWT_REFRESH_SECRET=change_this_refresh_secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
REDIS_URL=redis://127.0.0.1:6379
PORT=4000
```

Nota: usar `root` sin contraseña solo para desarrollo local. En producción crea un usuario con permisos limitados y password fuerte.

---

## Instalación y puesta en marcha (PowerShell)

1. Instalar dependencias:

```powershell
npm install
```

2. Generar Prisma client y aplicar migraciones (asegúrate que MySQL local esté corriendo y accesible según `DATABASE_URL`):

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

3. (Opcional) Poblar BD con datos iniciales:

```powershell
npm run seed
```

4. Levantar Redis (opcional — si quieres usar BullMQ):

Con Docker:
```powershell
docker run --name backend-redis -p 6379:6379 -d redis:7
# o con docker compose (usa el docker-compose.yml del repo):
docker compose up -d
```

Si usas WSL2/Ubuntu:
```bash
sudo apt update
sudo apt install -y redis-server
sudo service redis-server start
redis-cli ping  # debe responder PONG
```

5. Iniciar el servidor (en una terminal):

```powershell
npm run dev
```

6. Iniciar el worker (en otra terminal):

```powershell
node src/workers/reservationWorker.js
```

Si no quieres arrancar Redis, el productor tiene un fallback que crea la reserva directamente en la BD cuando Redis no responde. Además hay una ruta de desarrollo `/dev/create-reservation` que crea reservas sin usar la cola.

---

## Endpoints (resumen)

Auth:
- POST /auth/register { email, password, name? }
- POST /auth/login { email, password } -> { accessToken, refreshToken }
- POST /auth/refresh { refreshToken } -> { accessToken }
- POST /auth/logout { refreshToken }

Reservas:
- POST /reservations (protected) { tripId, seat } -> encola job (o crea directo si Redis no disponible)
- GET /reservations (protected) -> lista reservas del usuario

Dev (solo para testing local):
- POST /dev/create-reservation (protected) { tripId, seat } -> crea reserva directo en BD (útil sin Redis)

Protección: Usa header `Authorization: Bearer <accessToken>` para rutas protegidas.

---

## Pruebas con Postman (pasos)

1. POST /auth/login -> guarda `accessToken` y `refreshToken` en variables de entorno.
2. Usar `Authorization: Bearer {{accessToken}}` en requests protegidos.
3. POST /dev/create-reservation para pruebas directas.
4. POST /reservations para encolar (si Redis + worker están en marcha verás jobId y worker procesará).
5. GET /reservations para ver reservas del usuario.

Scripts de tests en Postman (Test tab) recomendados:

Login (guarda tokens automáticamente):
```javascript
const data = pm.response.json();
if (data.accessToken) pm.environment.set("accessToken", data.accessToken);
if (data.refreshToken) pm.environment.set("refreshToken", data.refreshToken);
```

Refresh (guarda nuevo accessToken):
```javascript
const data = pm.response.json();
if (data.accessToken) pm.environment.set("accessToken", data.accessToken);
```

---

## Troubleshooting — problemas comunes y soluciones

- Docker Desktop no arranca / errores con pipe `dockerDesktopLinuxEngine`: abre Docker Desktop y espera a que se inicie correctamente.
- Error Prisma P1000 (Authentication failed): revisa `DATABASE_URL` y credenciales, asegúrate MySQL esté corriendo y que el usuario y la DB existan.
- Worker muestra `ECONNREFUSED 127.0.0.1:6379`: Redis no está corriendo o `REDIS_URL` apunta a la dirección equivocada.
- BullMQ deprecation warning `maxRetriesPerRequest`: se corrigió pasando `{ maxRetriesPerRequest: null }` a la conexión ioredis en `src/queues/reservationQueue.js` y `src/workers/reservationWorker.js`.
- Si el worker intenta conectar y falla: revisa `docker ps` y `docker logs backend-redis`.

Comandos útiles:
```powershell
docker ps
docker logs backend-redis --tail 100
docker exec -it backend-redis redis-cli ping
node -e "const IORedis=require('ioredis'); const r=new IORedis(process.env.REDIS_URL||'redis://127.0.0.1:6379',{maxRetriesPerRequest:null}); r.ping().then(x=>{console.log('PING ->',x); r.quit();}).catch(e=>{console.error('PING ERR',e);});"
```

---

## Notas sobre decisiones implementadas

- Fallback de la cola: para facilitar desarrollo sin Redis, el productor intenta encolar y si la conexión falla crea la reserva directamente en la BD. Esto evita bloquear pruebas mientras Redis no esté disponible. En producción debes eliminar/ajustar el fallback y correr Redis + workers fiables.
- Ruta `/dev/create-reservation`: usada para pruebas locales rápidas sin depender de BullMQ.
- Seguridad: refresh tokens se almacenan en BD. Actualmente no implementamos rotación automática de refresh tokens — es una mejora recomendada.

---

## Comandos de mantenimiento y gestión de procesos (Windows PowerShell)

- Listar procesos Node que ejecutan el worker:
```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'reservationWorker.js' } | Select-Object ProcessId,CommandLine
```
- Detener worker por PID:
```powershell
Stop-Process -Id <PID> -Force
```
- Arrancar worker en primer plano (ver logs):
```powershell
node src/workers/reservationWorker.js
```
- Arrancar servidor en primer plano:
```powershell
node src/server.js
```

---

## Próximos pasos recomendados

1. Añadir validación de entrada (ej. express-validator o Joi) en endpoints.
2. Implementar rotación de refresh tokens (emitir refresh nuevo en /refresh y revocar el anterior).
3. Añadir constraint único a nivel DB para (tripId, seat) para proteger contra race conditions; usar transacciones o bloqueo para la creación de reservas en el worker.
4. Migrar a Postgres para producción y añadir Docker Compose que incluya la aplicación, Redis y Postgres para desarrollo reproducible.
5. Agregar tests (jest + supertest) para endpoints auth y reservations.

---

## Resumen de cambios y estado actual

- Migraciones aplicadas: la BD `reservas` fue creada y las tablas sincronizadas con `schema.prisma`.
- Seed ejecutado: usuario `admin@example.com` (Pass1234), buses, trips y una reserva de ejemplo fueron insertados.
- Worker y cola: implementados y probados; arreglada la advertencia deprecación de BullMQ.

Si necesitas que genere una colección de Postman o prepare un `docker-compose` que arranque Redis + worker + app, puedo agregarlo y documentarlo aquí.

---

Si quieres que actualice el `README.md` con un resumen breve y un link a este `DOCUMENTATION.md`, dímelo y lo hago.

Gracias — dime qué más quieres que documente o si quieres que prepare la colección de Postman lista para importar.
