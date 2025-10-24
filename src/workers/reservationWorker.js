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

    // enqueue email confirmation
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      // include bus so we can show plate/number
      const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { bus: true } });
      const { addEmailToQueue } = require('../queues/emailQueue');
      const formatDate = require('../utils/formatDate')

      const busInfo = trip.bus ? `${trip.bus.plate}` : `${trip.busId}`;
      const departAt = trip.departAt ? formatDate(trip.departAt) : '-';
      const price = trip.price != null ? `${trip.price}` : '-';

      const subject = `Reserva confirmada - viaje ${trip.origin} -> ${trip.destination}`;
      const text = `Hola ${user.name || user.email},\n\nTu reserva (ID: ${reservation.id}) para el viaje ${trip.origin} -> ${trip.destination} ha sido confirmada.\n\nDetalles:\n- Bus: ${busInfo}\n- Fecha y hora de salida: ${departAt}\n- Asiento: ${seat}\n- Precio: ${price}\n\nGracias.`;
      const html = `<p>Hola ${user.name || user.email},</p>
        <p>Tu reserva (ID: <strong>${reservation.id}</strong>) para el viaje <strong>${trip.origin} → ${trip.destination}</strong> ha sido confirmada.</p>
        <ul>
          <li><strong>Bus:</strong> ${busInfo}</li>
          <li><strong>Fecha y hora de salida:</strong> ${departAt}</li>
          <li><strong>Asiento:</strong> ${seat}</li>
          <li><strong>Precio:</strong> ${price}</li>
        </ul>
        <p>Gracias.</p>`;
      await addEmailToQueue({ to: user.email, subject, text, html });
    } catch (e) {
      console.error('Failed to enqueue confirmation email', e.message);
    }

    return reservation;
  }
}, { connection });

worker.on('completed', job => console.log('Job completed', job.id));
worker.on('failed', (job, err) => console.error('Job failed', job.id, err.message));

module.exports = worker;
