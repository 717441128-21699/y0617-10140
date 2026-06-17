import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { connectMongoDB, disconnectMongoDB } from './db/mongodb';
import { getRedisClient, disconnectRedis } from './db/redis';
import { jobScheduler } from './scheduler/JobScheduler';
import routes from './routes';
import logger from './utils/logger';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Not Found',
  });
});

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Distributed Job Scheduler Server...');

    await connectMongoDB();
    getRedisClient();

    await jobScheduler.start();

    app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Instance ID: ${config.instanceId}`);
      logger.info(`API Documentation: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Received shutdown signal, graceful shutdown...');

  try {
    await jobScheduler.stop();
    await disconnectRedis();
    await disconnectMongoDB();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR2', shutdown);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (require.main === module) {
  startServer();
}

export default app;
