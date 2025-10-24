const prisma = require('../prismaClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const ACCESS_EXP = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_EXP = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

function signAccess(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}

function signRefresh(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

exports.register = async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'user exists' });
  const hashed = await bcrypt.hash(password, 10);
  // Ensure public registrations always get TRAVELER role. Admin accounts can only be created
  // via the admin-only endpoints.
  const user = await prisma.user.create({ data: { email, password: hashed, name, role: 'TRAVELER' } });
  // enqueue welcome email (non-blocking)
  try{
    const { addEmailToQueue } = require('../queues/emailQueue')
    const subject = 'Bienvenido a BusReservation'
    const text = `Hola ${user.name || user.email},\n\nGracias por registrarte.`
    const html = `<p>Hola ${user.name || user.email},</p><p>Gracias por registrarte en BusReservation.</p>`
    addEmailToQueue({ to: user.email, subject, text, html }).catch(e=>console.error('enqueue welcome email failed', e.message))
  } catch(e){ console.error('failed to enqueue welcome email', e.message) }

  res.json({ id: user.id, email: user.email });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);

  // store refresh token
  const decoded = jwt.decode(refreshToken);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: new Date(decoded.exp * 1000) } });

  res.json({ accessToken, refreshToken, role: user.role });
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  // check exists in DB
  const dbToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!dbToken) return res.status(401).json({ error: 'invalid refresh token' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(404).json({ error: 'user not found' });
    const accessToken = signAccess(user);
    res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  res.json({ ok: true });
};
