import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/job_scheduler',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',
  scheduleInterval: parseInt(process.env.SCHEDULE_INTERVAL || '1000', 10),
  lockTtl: parseInt(process.env.LOCK_TTL || '5000', 10),
  instanceId: process.env.INSTANCE_ID || `scheduler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
};
