require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const reservationRoutes = require('./routes/reservations');
const devRoutes = require('./routes/dev');
const tripsRoutes = require('./routes/trips');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(morgan('dev'));
// CORS: allow requests from frontend during development
const allowedOrigins = (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.split(',')) || ['http://localhost:3000']
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => res.json({ ok: true, msg: 'Bus Reservation API' }));
app.use('/auth', authRoutes);
app.use('/reservations', reservationRoutes);
app.use('/dev', devRoutes);
app.use('/trips', tripsRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
