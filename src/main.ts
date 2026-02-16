import 'reflect-metadata';
import express from 'express';
import './shared/container';
import { processVideoRoutes } from './routes';
import { rabbitmqClient } from './infrastructure/broker/broker.gateway';
import { startVideoProcessingConsumer } from './infrastructure/broker/video-processing.consumer';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/videos', processVideoRoutes);

async function bootstrap(): Promise<void> {
  try {
    await rabbitmqClient.connect();
    await startVideoProcessingConsumer();
    console.log('[Bootstrap] RabbitMQ consumer started');
  } catch (error) {
    console.error('[Bootstrap] Failed to start RabbitMQ consumer:', error);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
