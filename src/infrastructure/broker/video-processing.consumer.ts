import { ConsumeMessage } from 'amqplib';
import { container } from '../../shared/container';
import { rabbitmqClient } from './broker.gateway';
import { VideoProcessingMessageDTO } from './broker.types';
import { IProcessVideoService } from '../../features/process-video/process-video.service.interface';

const QUEUE_NAME = process.env.VIDEO_PROCESSING_QUEUE || 'video.processing';

export async function startVideoProcessingConsumer(): Promise<void> {
  const channel = await rabbitmqClient.getChannel();

  await channel.prefetch(1);

  console.log(`[Consumer] Listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const content = msg.content.toString();
    console.log(`[Consumer] Received message: ${content}`);

    let payload: VideoProcessingMessageDTO;

    try {
      payload = JSON.parse(content) as VideoProcessingMessageDTO;
    } catch {
      console.error('[Consumer] Failed to parse message, nacking without requeue');
      channel.nack(msg, false, false);
      return;
    }

    try {
      const processVideoService = container.resolve<IProcessVideoService>('ProcessVideoService');

      const intervalMs =
        payload.framesPerSecond > 0 ? Math.round(1000 / payload.framesPerSecond) : 1000;

      await processVideoService.processVideo({
        file: payload.inputUrlStorage,
        intervalMs,
        format: payload.format ?? 'jpg',
      });

      console.log(`[Consumer] Job ${payload.jobId} processed successfully`);
      channel.ack(msg);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Consumer] Job ${payload.jobId} failed: ${errorMsg}`);
      channel.nack(msg, false, false);
    }
  });
}
