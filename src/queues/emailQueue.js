const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const redisOptions = { maxRetriesPerRequest: null };
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', redisOptions);
const emailQueue = new Queue('emails', { connection });

async function addEmailToQueue(data) {
  return emailQueue.add('send-email', data);
}

module.exports = { addEmailToQueue };
