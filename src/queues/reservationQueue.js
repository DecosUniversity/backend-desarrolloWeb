const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const prisma = require('../prismaClient');

// Try to lazily connect to Redis when adding a job. If Redis is unavailable,
// fallback to creating the reservation directly in the DB so the server still works
// in environments without Redis (useful for local dev).
async function addReservationToQueue(data) {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  try {
    const redisOptions = { maxRetriesPerRequest: null };
    const connection = new IORedis(redisUrl, redisOptions);
    const reservationQueue = new Queue('reservations', { connection });
    const job = await reservationQueue.add('create-reservation', data);
    // gracefully disconnect the connection
    await connection.quit();
    return job;
  } catch (err) {
    console.warn('Redis not available, falling back to direct DB reservation:', err.message);
    // Directly create the reservation in the DB as a fallback.
    // Note: this bypasses any worker-side checks beyond seat uniqueness check here.
    // Basic checks
    const { userId, tripId, seat } = data;
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { bus: true } });
    if (!trip) throw new Error('trip not found');
    if (seat < 1 || seat > trip.bus.capacity) throw new Error('invalid seat');
    const exists = await prisma.reservation.findFirst({ where: { tripId, seat } });
    if (exists) throw new Error('seat already taken');
    const reservation = await prisma.reservation.create({ data: { userId, tripId, seat } });
    return { id: reservation.id, fallback: true };
  }
}

module.exports = { addReservationToQueue };
