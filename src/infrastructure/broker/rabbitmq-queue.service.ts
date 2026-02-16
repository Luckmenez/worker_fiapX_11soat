import { injectable } from 'tsyringe';
import { rabbitmqClient } from './broker.gateway';
import { VideoCompletedMessageDTO } from './broker.types';

@injectable()
export class RabbitMQQueueService {
  async publishVideoCompleted(message: VideoCompletedMessageDTO): Promise<void> {
    // const startTime = Date.now();
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

      // const duration = Date.now() - startTime;

      console.log(`[RabbitMQ] Message published to ${queue}:`, {
        jobId: message.jobId,
        status: message.status,
        framesExtracted: message.framesExtracted,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('[RabbitMQ] Failed to publish message:', errorMessage);

      throw new Error(`RabbitMQ unavailable: ${errorMessage}`);
    }
  }

  async close(): Promise<void> {
    await rabbitmqClient.close();
  }
}
