import { ConsumeMessage } from 'amqplib';
import { container } from '../../shared/container';
import { rabbitmqClient } from './broker.gateway';
import { VideoProcessingMessageDTO } from './broker.types';
import { IProcessVideoService } from '../../features/process-video/process-video.service.interface';
import { logRabbitMQ, logError } from '../monitoring';

const QUEUE_NAME = process.env.VIDEO_PROCESSING_QUEUE || 'video.processing';

function extractS3PrefixFromUrl(presignedUrl: string): string {
  try {
    const url = new URL(presignedUrl);
    const pathname = url.pathname;
    const key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    return key;
  } catch (error) {
    logError(error, 'VideoProcessingConsumer.extractS3Prefix', { url: presignedUrl });
    return 'output';
  }
}

export async function startVideoProcessingConsumer(): Promise<void> {
  const channel = await rabbitmqClient.getChannel();

  await channel.prefetch(1);

  logRabbitMQ('consumer.start', `Listening on queue: ${QUEUE_NAME}`, { queue: QUEUE_NAME });

  channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const content = msg.content.toString();
    logRabbitMQ('consumer.message', 'Received message', { messageLength: content.length });

    let payload: VideoProcessingMessageDTO;

    try {
      payload = JSON.parse(content) as VideoProcessingMessageDTO;
    } catch {
      logError(new Error('Failed to parse message'), 'VideoProcessingConsumer', { content });
      channel.nack(msg, false, false);
      return;
    }

    try {
      const processVideoService = container.resolve<IProcessVideoService>('ProcessVideoService');

      const intervalMs =
        payload.framesPerSecond > 0 ? Math.round(1000 / payload.framesPerSecond) : 1000;

      const outputS3Prefix = extractS3PrefixFromUrl(payload.outputUrlStorage);

      await processVideoService.processVideo({
        file: payload.inputUrlStorage,
        intervalMs,
        format: payload.format ?? 'jpg',
        jobId: payload.jobId,
        outputS3Prefix,
      });

      logRabbitMQ('consumer.success', `Job ${payload.jobId} processed successfully`, {
        jobId: payload.jobId,
      });
      channel.ack(msg);
    } catch (error) {
      logError(error, 'VideoProcessingConsumer', { jobId: payload.jobId });
      channel.nack(msg, false, false);
    }
  });
}
