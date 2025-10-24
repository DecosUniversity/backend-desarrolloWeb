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
    return { type: 'queue', jobId: job.id };
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
    console.log('Created reservation directly in DB (fallback), id=', reservation.id);
    // enqueue confirmation email
    try{
      const user = await prisma.user.findUnique({ where: { id: userId } })
      const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { bus: true } })
      const { addEmailToQueue } = require('./emailQueue')
      const formatDate = require('../utils/formatDate')
      const busInfo = trip.bus ? `${trip.bus.plate}` : `${trip.busId}`
      const departAt = trip.departAt ? formatDate(trip.departAt) : '-'
      const price = trip.price != null ? `${trip.price}` : '-'
      const subject = `Reserva confirmada - viaje ${trip.origin} -> ${trip.destination}`
      const text = `Hola ${user.name || user.email},\n\nTu reserva (ID: ${reservation.id}) para el viaje ${trip.origin} -> ${trip.destination} ha sido confirmada.\n\nDetalles:\n- Bus: ${busInfo}\n- Fecha y hora de salida: ${departAt}\n- Asiento: ${seat}\n- Precio: ${price}`
      const html = `<p>Hola ${user.name || user.email},</p>
        <p>Tu reserva (ID: <strong>${reservation.id}</strong>) para el viaje <strong>${trip.origin} → ${trip.destination}</strong> ha sido confirmada.</p>
        <ul>
          <li><strong>Bus:</strong> ${busInfo}</li>
          <li><strong>Fecha y hora de salida:</strong> ${departAt}</li>
          <li><strong>Asiento:</strong> ${seat}</li>
          <li><strong>Precio:</strong> ${price}</li>
        </ul>`
      addEmailToQueue({ to: user.email, subject, text, html }).catch(e => console.error('enqueue confirmation email failed', e.message))
    } catch(e){ console.error('failed to enqueue confirmation email', e.message) }

    return { type: 'fallback', reservationId: reservation.id };
  }
}

module.exports = { addReservationToQueue };
