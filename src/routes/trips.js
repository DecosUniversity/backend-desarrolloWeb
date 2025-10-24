const express = require('express')
const router = express.Router()
const prisma = require('../prismaClient')

// Public: list trips
router.get('/', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({ include: { bus: true } })
    res.json(trips)
  } catch (err) {
    console.error('GET /trips error', err)
    res.status(500).json({ error: 'internal_error' })
  }
})

// Public: get trip detail including bus and reservations
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { bus: true, reservations: true }
    })
    if (!trip) return res.status(404).json({ error: 'trip_not_found' })
    res.json(trip)
  } catch (err) {
    console.error('GET /trips/:id error', err)
    res.status(500).json({ error: 'internal_error' })
  }
})

module.exports = router
