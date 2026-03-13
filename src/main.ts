import 'reflect-metadata';
import './env';

import express from 'express';
import './shared/container';
import { processVideoRoutes } from './routes';
import { healthRoutes } from './infrastructure/routes/health.routes';
import { rabbitmqClient } from './infrastructure/broker/broker.gateway';
import { startVideoProcessingConsumer } from './infrastructure/broker/video-processing.consumer';
import { startBatchVideoProcessingConsumer } from './infrastructure/broker/batch-video-processing.consumer';
import { startDeadLetterConsumer } from './infrastructure/broker/dead-letter.consumer';
import { logger, logRabbitMQ, logError } from './infrastructure/monitoring';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/health', healthRoutes);
app.use('/videos', processVideoRoutes);

async function bootstrap(): Promise<void> {
  try {
    await rabbitmqClient.connect();

    await startVideoProcessingConsumer();
    logRabbitMQ('bootstrap', 'Video processing consumer started');

    await startBatchVideoProcessingConsumer();
    logRabbitMQ('bootstrap', 'Batch video processing consumer started');

    await startDeadLetterConsumer();
    logRabbitMQ('bootstrap', 'Dead Letter Queue consumer started');

    logger.info({ type: 'bootstrap.success' }, 'All RabbitMQ consumers started successfully');
  } catch (error) {
    logError(error, 'Bootstrap');
  }

  app.listen(PORT, () => {
    logger.info(
      {
        type: 'server.start',
        port: PORT,
        env: process.env.NODE_ENV || 'development',
      },
      `Server running on port ${PORT}`
    );
  });
}

bootstrap();
