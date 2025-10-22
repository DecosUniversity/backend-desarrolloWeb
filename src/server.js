require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const reservationRoutes = require('./routes/reservations');
const devRoutes = require('./routes/dev');

const app = express();
app.use(morgan('dev'));
app.use(bodyParser.json());

app.get('/', (req, res) => res.json({ ok: true, msg: 'Bus Reservation API' }));
app.use('/auth', authRoutes);
app.use('/reservations', reservationRoutes);
app.use('/dev', devRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
