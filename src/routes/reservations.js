const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createReservation, listReservations } = require('../controllers/reservationController');

router.use(auth);
router.post('/', createReservation);
router.get('/', listReservations);

module.exports = router;
