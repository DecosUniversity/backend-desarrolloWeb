const { Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const prisma = require('../prismaClient');

const redisOptions = { maxRetriesPerRequest: null };
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', redisOptions);
new QueueScheduler('reservations', { connection });

const worker = new Worker('reservations', async job => {
  if (job.name === 'create-reservation') {
    const { userId, tripId, seat } = job.data;
    // check if seat already taken
    const exists = await prisma.reservation.findFirst({ where: { tripId, seat } });
    if (exists) throw new Error('seat already taken');

    // create reservation
    const reservation = await prisma.reservation.create({ data: { userId, tripId, seat } });
    // optionally send confirmation email (not implemented)
    return reservation;
  }
}, { connection });

worker.on('completed', job => console.log('Job completed', job.id));
worker.on('failed', (job, err) => console.error('Job failed', job.id, err.message));

module.exports = worker;
