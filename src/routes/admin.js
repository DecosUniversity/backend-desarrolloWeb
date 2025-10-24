const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// helper to enqueue admin/system jobs
async function enqueueAdminJob(name, data){
  try{
    const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null })
    const q = new Queue('admin-tasks', { connection })
    await q.add(name, data)
    await connection.quit()
  } catch(e){
    console.error('Failed to enqueue admin job', name, e.message)
  }
}
// Protected admin routes
router.use(auth);
router.use(requireRole('ADMIN'));

// List buses (admin)
router.get('/buses', async (req, res) => {
  try{
    const buses = await prisma.bus.findMany()
    res.json(buses)
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// List trips (admin)
router.get('/trips', async (req, res) => {
  try{
    const trips = await prisma.trip.findMany({ include: { bus: true } })
    res.json(trips)
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// --- User management (admin-only)
router.get('/users', async (req, res) => {
  try{
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } })
    res.json(users)
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// Queue inspection and management endpoints (admin-only)
// GET /admin/queues  -> return known queues
router.get('/queues', async (req, res) => {
  try{
    // Return known queue names used by the application
    const known = ['emails','reservations','admin-tasks']
    res.json(known)
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// GET /admin/queues/:name/counts
router.get('/queues/:name/counts', async (req, res) => {
  try{
    const name = req.params.name
    const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null })
    const q = new Queue(name, { connection })
    const counts = await q.getJobCounts()
    await connection.quit()
    res.json(counts)
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// GET /admin/queues/:name/jobs?status=waiting&page=0&pageSize=50
router.get('/queues/:name/jobs', async (req, res) => {
  try{
    const name = req.params.name
    const status = req.query.status || 'waiting'
    const page = Math.max(0, parseInt(req.query.page || '0', 10))
    const pageSize = Math.min(Math.max(1, parseInt(req.query.pageSize || '50', 10)), 200)
    const start = page * pageSize
    const end = start + pageSize - 1
    const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null })
    const q = new Queue(name, { connection })
    const allowed = ['waiting','active','completed','failed','delayed','waiting-children']
    const types = allowed.includes(status) ? [status] : ['waiting']
    const jobs = await q.getJobs(types, start, end, false)
    const out = jobs.map(j => ({ id: j.id, name: j.name, data: j.data, attemptsMade: j.attemptsMade, failedReason: j.failedReason, timestamp: j.timestamp, processedOn: j.processedOn, finishedOn: j.finishedOn }))
    await connection.quit()
    res.json({ page, pageSize, jobs: out })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// GET job detail: /admin/queues/:name/jobs/:jobId
router.get('/queues/:name/jobs/:jobId', async (req, res) => {
  try{
    const { name, jobId } = req.params
    const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null })
    const q = new Queue(name, { connection })
    const job = await q.getJob(jobId)
    if(!job){ await connection.quit(); return res.status(404).json({ error: 'job not found' }) }
    // return detailed info
    const detail = {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    }
    await connection.quit()
    res.json(detail)
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// POST /admin/queues/:name/jobs/:jobId/retry
router.post('/queues/:name/jobs/:jobId/retry', async (req, res) => {
  try{
    const { name, jobId } = req.params
    const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null })
    const q = new Queue(name, { connection })
    const job = await q.getJob(jobId)
    if(!job) { await connection.quit(); return res.status(404).json({ error: 'job not found' }) }
    await job.retry()
    await connection.quit()
    res.json({ ok: true })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// DELETE /admin/queues/:name/jobs/:jobId
router.delete('/queues/:name/jobs/:jobId', async (req, res) => {
  try{
    const { name, jobId } = req.params
    const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null })
    const q = new Queue(name, { connection })
    const job = await q.getJob(jobId)
    if(!job) { await connection.quit(); return res.status(404).json({ error: 'job not found' }) }
    await job.remove()
    await connection.quit()
    res.json({ ok: true })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

router.post('/users', async (req, res) => {
  const { email, password, name, role } = req.body
  if(!email || !password) return res.status(400).json({ error: 'email and password required' })
  if(role && !['ADMIN','TRAVELER'].includes(role)) return res.status(400).json({ error: 'invalid role' })
  try{
    const bcrypt = require('bcrypt')
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, password: hashed, name, role: role || 'TRAVELER' } })
    // enqueue welcome email
    try{
      const { addEmailToQueue } = require('../queues/emailQueue')
      const subject = 'Cuenta creada'
      const text = `Hola ${user.name || user.email},\n\nTu cuenta ha sido creada.`
      const html = `<p>Hola ${user.name || user.email},</p><p>Tu cuenta ha sido creada.</p>`
      addEmailToQueue({ to: user.email, subject, text, html }).catch(e=>console.error('enqueue welcome email failed', e.message))
    } catch(e){ console.error('failed to enqueue welcome email', e.message) }

    res.json({ id: user.id, email: user.email })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// Update user (name, role)
router.put('/users/:id', async (req, res) => {
  const { id } = req.params
  const { name, role } = req.body
  try{
    const data = {}
    if(name !== undefined) data.name = name
    if(role !== undefined){
      if(!['ADMIN','TRAVELER'].includes(role)) return res.status(400).json({ error: 'invalid role' })
      data.role = role
    }
    const user = await prisma.user.update({ where: { id: Number(id) }, data })
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// Delete user
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params
  try{
    await prisma.user.delete({ where: { id: Number(id) } })
    res.json({ ok: true })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// Add Bus
router.post('/buses', async (req, res) => {
  const { plate, capacity } = req.body;
  if(!plate || !capacity) return res.status(400).json({ error: 'plate and capacity required' });
  try{
    const bus = await prisma.bus.create({ data: { plate, capacity: Number(capacity) } });
    res.json(bus);
    // enqueue admin job (best-effort)
    enqueueAdminJob('bus.created', { busId: bus.id, plate: bus.plate, capacity: bus.capacity, by: req.user?.id })
  } catch(e){
    res.status(500).json({ error: e.message });
  }
});

// Update Bus
router.put('/buses/:id', async (req, res) => {
  const { id } = req.params
  const { plate, capacity } = req.body
  try{
    const data = {}
    if(plate !== undefined) data.plate = plate
    if(capacity !== undefined) data.capacity = Number(capacity)
    const bus = await prisma.bus.update({ where: { id: Number(id) }, data })
    res.json(bus)
    enqueueAdminJob('bus.updated', { busId: bus.id, updates: data, by: req.user?.id })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// Delete Bus
router.delete('/buses/:id', async (req, res) => {
  const { id } = req.params
  try{
    const bus = await prisma.bus.delete({ where: { id: Number(id) }})
    res.json({ ok: true, id: bus.id })
    enqueueAdminJob('bus.deleted', { busId: bus.id, plate: bus.plate, by: req.user?.id })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// Add Trip
router.post('/trips', async (req, res) => {
  const { busId, origin, destination, departAt, price } = req.body;
  if(!busId || !origin || !destination || !departAt || !price) return res.status(400).json({ error: 'missing fields' });
  try{
    const trip = await prisma.trip.create({ data: { busId: Number(busId), origin, destination, departAt: new Date(departAt), price: Number(price) } });
    res.json(trip);
    enqueueAdminJob('trip.created', { tripId: trip.id, busId: trip.busId, origin: trip.origin, destination: trip.destination, departAt: trip.departAt, price: trip.price, by: req.user?.id })
  } catch(e){
    res.status(500).json({ error: e.message });
  }
});

// Update Trip
router.put('/trips/:id', async (req, res) => {
  const { id } = req.params
  const { busId, origin, destination, departAt, price } = req.body
  try{
    const data = {}
    if(busId !== undefined) data.busId = Number(busId)
    if(origin !== undefined) data.origin = origin
    if(destination !== undefined) data.destination = destination
    if(departAt !== undefined) data.departAt = new Date(departAt)
    if(price !== undefined) data.price = Number(price)
      const trip = await prisma.trip.update({ where: { id: Number(id) }, data })
      res.json(trip)
      enqueueAdminJob('trip.updated', { tripId: trip.id, busId: trip.busId, origin: trip.origin, destination: trip.destination, departAt: trip.departAt, price: trip.price, by: req.user?.id })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

// Delete Trip
router.delete('/trips/:id', async (req, res) => {
  const { id } = req.params
  try{
          const trip = await prisma.trip.delete({ where: { id: Number(id) } })
          res.json({ ok: true, id: trip.id })
          enqueueAdminJob('trip.deleted', { tripId: trip.id, busId: trip.busId, origin: trip.origin, destination: trip.destination, departAt: trip.departAt, price: trip.price, by: req.user?.id })
  } catch(e){
    res.status(500).json({ error: e.message })
  }
})

module.exports = router;
