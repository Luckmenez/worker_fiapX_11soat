import { injectable } from 'tsyringe';
import { rabbitmqClient } from './broker.gateway';
import { VideoCompletedMessageDTO } from './broker.types';
import { logRabbitMQ, logError } from '../monitoring';

@injectable()
export class RabbitMQQueueService {
  async publishVideoCompleted(message: VideoCompletedMessageDTO): Promise<void> {
    try {
      const channel = await rabbitmqClient.getChannel();
      const queue = process.env.VIDEO_COMPLETED_QUEUE || 'video.completed';
      const messageBuffer = Buffer.from(JSON.stringify(message));

      const sent = channel.sendToQueue(queue, messageBuffer, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      });

      if (!sent) {
        throw new Error('Failed to send message to queue (buffer full)');
      }

      logRabbitMQ('publish.completed', `Message published to ${queue}`, {
        queue,
        jobId: message.jobId,
        status: message.status,
        framesExtracted: message.framesExtracted,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError(error, 'RabbitMQQueueService.publishVideoCompleted', { message });

      throw new Error(`RabbitMQ unavailable: ${errorMessage}`);
    }
  }

  async close(): Promise<void> {
    await rabbitmqClient.close();
  }
}
