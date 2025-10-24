const { Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const nodemailer = require('nodemailer');

const redisOptions = { maxRetriesPerRequest: null };
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', redisOptions);
new QueueScheduler('emails', { connection });

let transporter
async function createTransporter(){
  if(process.env.SMTP_USER){
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_SECURE === 'true'),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    return transporter
  }

  // No SMTP configured — fall back to Ethereal test account for development
  console.log('No SMTP_USER configured — creating Ethereal test account for email worker (dev only)')
  const testAccount = await nodemailer.createTestAccount()
  console.log('Ethereal account created. User:', testAccount.user)
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  })
  return transporter
}

const worker = new Worker('emails', async job => {
  if (job.name === 'send-email') {
    const { to, subject, text, html } = job.data;
    try {
      if(!transporter) await createTransporter()
      const fromAddr = process.env.SMTP_USER || transporter.options.auth.user || 'no-reply@example.com'
      const info = await transporter.sendMail({ from: fromAddr, to, subject, text, html });
      // Log messageId and preview URL when available (Ethereal)
      const preview = nodemailer.getTestMessageUrl(info);
      console.log(`Email sent job=${job.id} messageId=${info.messageId}`);
      if (preview) console.log(`Preview URL: ${preview}`);
      return info;
    } catch (err) {
      // Rethrow to let BullMQ mark the job as failed, but log details first
      console.error('Error sending email for job', job.id, err);
      throw err;
    }
  }
}, { connection });

worker.on('completed', job => console.log('Email job completed', job.id));
worker.on('failed', (job, err) => console.error('Email job failed', job.id, err.message));

module.exports = worker;
