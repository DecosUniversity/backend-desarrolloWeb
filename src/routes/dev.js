const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../prismaClient');

// Dev-only: create reservation directly (bypass queue) for testing
router.use(auth);
router.post('/create-reservation', async (req, res) => {
  const { tripId, seat } = req.body;
  if (!tripId || !seat) return res.status(400).json({ error: 'tripId and seat required' });
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { bus: true } });
  if (!trip) return res.status(404).json({ error: 'trip not found' });
  if (seat < 1 || seat > trip.bus.capacity) return res.status(400).json({ error: 'invalid seat' });
  const exists = await prisma.reservation.findFirst({ where: { tripId, seat } });
  if (exists) return res.status(409).json({ error: 'seat already taken' });
  const reservation = await prisma.reservation.create({ data: { userId: req.user.id, tripId, seat } });
  res.json(reservation);
});

module.exports = router;
