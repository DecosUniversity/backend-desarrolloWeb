const prisma = require('../prismaClient');
const { addReservationToQueue } = require('../queues/reservationQueue');

exports.createReservation = async (req, res) => {
  const { tripId, seat } = req.body;
  if (!tripId || !seat) return res.status(400).json({ error: 'tripId and seat required' });

  // basic checks: trip exists and seat within capacity
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { bus: true } });
  if (!trip) return res.status(404).json({ error: 'trip not found' });
  if (seat < 1 || seat > trip.bus.capacity) return res.status(400).json({ error: 'invalid seat' });

  // enqueue reservation for processing (worker will create it)
  const job = await addReservationToQueue({ userId: req.user.id, tripId, seat });
  res.json({ ok: true, jobId: job.id });
};

exports.listReservations = async (req, res) => {
  const reservations = await prisma.reservation.findMany({ where: { userId: req.user.id }, include: { trip: true } });
  res.json(reservations);
};
