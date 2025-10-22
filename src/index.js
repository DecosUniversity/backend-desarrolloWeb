// compatibility entry: start worker and server if run directly
require('./workers/reservationWorker');
// emailWorker is optional; start it when you want to process outbound emails
try { require('./workers/emailWorker'); } catch (e) { /* ignore if redis not configured */ }
require('./server');
