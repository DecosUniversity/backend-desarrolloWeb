const prisma = require('../prismaClient');
const { addReservationToQueue } = require('../queues/reservationQueue');

exports.createReservation = async (req, res) => {
  const { tripId, seat } = req.body;
  if (!tripId || !seat) return res.status(400).json({ error: 'tripId and seat required' });

  // basic checks: trip exists and seat within capacity
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { bus: true } });
  if (!trip) return res.status(404).json({ error: 'trip not found' });
  if (seat < 1 || seat > trip.bus.capacity) return res.status(400).json({ error: 'invalid seat' });
  // prevent reservations for trips whose departure datetime is in the past
  const now = new Date()
  const depart = new Date(trip.departAt)
  if (depart.getTime() <= now.getTime()) return res.status(400).json({ error: 'trip already departed' })

  // enqueue reservation for processing (worker will create it)
  const result = await addReservationToQueue({ userId: req.user.id, tripId, seat });
  if (result?.type === 'queue') {
    return res.json({ ok: true, jobId: result.jobId, source: 'queue' });
  }
  if (result?.type === 'fallback') {
    return res.json({ ok: true, reservationId: result.reservationId, source: 'fallback' });
  }

  // Generic fallback
  res.json({ ok: true, info: result });
};

exports.listReservations = async (req, res) => {
  // include trip and its bus so frontend can render complete reservation details
  const reservations = await prisma.reservation.findMany({
    where: { userId: req.user.id },
    include: { trip: { include: { bus: true } } }
  });
  res.json(reservations);
};
