import { ConsumeMessage } from 'amqplib';
import { container } from '../../shared/container';
import { rabbitmqClient } from './broker.gateway';
import {
  BatchVideoProcessingMessageDTO,
  IndividualVideoProcessingDTO,
} from './batch-video-processing.types';
import { IProcessVideoService } from '../../features/process-video/process-video.service.interface';
import { logRabbitMQ, logBatchProcessing, logError } from '../monitoring';

const QUEUE_NAME = process.env.BATCH_VIDEO_PROCESSING_QUEUE || 'batch.video.processing';
const MAX_RETRY_COUNT = 2;

/**
 * Consumer for batch video processing with retry and DLQ support
 *
 * Receives a batch of videos and processes each one individually
 * If processing fails, message is retried up to MAX_RETRY_COUNT times
 * After max retries, message goes to Dead Letter Queue for notification
 */
export async function startBatchVideoProcessingConsumer(): Promise<void> {
  const channel = await rabbitmqClient.getChannel();

  // Process one batch at a time
  await channel.prefetch(1);

  logRabbitMQ('batch.consumer.start', `Listening on queue: ${QUEUE_NAME}`, { queue: QUEUE_NAME });

  channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const content = msg.content.toString();
    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

    logRabbitMQ('batch.consumer.message', 'Received batch message', { retryCount });

    let payload: BatchVideoProcessingMessageDTO;

    try {
      payload = JSON.parse(content) as BatchVideoProcessingMessageDTO;
    } catch (error) {
      logError(new Error('Failed to parse batch message'), 'BatchVideoProcessingConsumer');
      // Parse error - não adianta retry, descarta
      channel.nack(msg, false, false);
      return;
    }

    const { person, videos } = payload;

    logBatchProcessing('batch', `Processing batch for ${person.email} with ${videos.length} videos`, {
      email: person.email,
      videoCount: videos.length,
      retryCount
    });

    try {
      // Process each video in the batch
      let successCount = 0;
      let failureCount = 0;

      for (const video of videos) {
        try {
          logBatchProcessing('batch', `Processing video ${video.id}`, {
            videoId: video.id,
            current: successCount + 1,
            total: videos.length
          });

          await processIndividualVideo({
            videoId: video.id,
            processingId: video.id_processamento,
            clientId: person.clientId,
            email: person.email,
            userName: person.name,
            framesPerSecond: video.framesPerSecond,
            format: video.format,
            inputS3Url: video.input_url,
            outputS3Url: video.output_url,
          });

          successCount++;
          logBatchProcessing('batch', `Video ${video.id} processed successfully`, {
            videoId: video.id,
            successCount,
            total: videos.length
          });
        } catch (error) {
          failureCount++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logError(error, 'BatchVideoProcessingConsumer.video', {
            videoId: video.id,
            failureCount
          });

          // Se houver falha em qualquer vídeo, lança exceção para reprocessar todo o lote
          throw error;
        }
      }

      logBatchProcessing('batch', 'Batch completed successfully', {
        successCount,
        failureCount,
        total: videos.length
      });

      // ACK - sucesso total
      channel.ack(msg);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logError(error, 'BatchVideoProcessingConsumer.batch', {
        retryCount,
        email: person.email
      });

      // Verificar se ainda pode retry
      if (retryCount < MAX_RETRY_COUNT) {
        // NACK com requeue - vai tentar novamente
        logRabbitMQ('batch.consumer.retry', `Retrying batch (attempt ${retryCount + 1}/${MAX_RETRY_COUNT})`, {
          retryCount: retryCount + 1,
          email: person.email,
        });

        // Incrementar contador de retry
        const newHeaders = {
          ...msg.properties.headers,
          'x-retry-count': retryCount + 1,
        };

        // Republica a mensagem com header atualizado
        channel.publish(
          '',
          QUEUE_NAME,
          Buffer.from(content),
          {
            ...msg.properties,
            headers: newHeaders,
          }
        );

        // ACK a mensagem original
        channel.ack(msg);
      } else {
        // Atingiu máximo de retries - vai para DLQ
        logRabbitMQ('batch.consumer.max-retries', `Max retries reached - sending to DLQ`, {
          retryCount,
          email: person.email,
        });

        // NACK sem requeue - vai para DLQ
        channel.nack(msg, false, false);
      }
    }
  });
}

/**
 * Process a single video from the batch
 */
async function processIndividualVideo(video: IndividualVideoProcessingDTO): Promise<void> {
  const processVideoService = container.resolve<IProcessVideoService>('ProcessVideoService');

  const intervalMs = video.framesPerSecond > 0 ? Math.round(1000 / video.framesPerSecond) : 1000;

  logBatchProcessing(video.videoId, 'Starting processing');
  logBatchProcessing(video.videoId, 'Input configured', { inputS3Url: video.inputS3Url });
  logBatchProcessing(video.videoId, 'Output configured', { outputS3Url: video.outputS3Url });
  logBatchProcessing(video.videoId, 'Processing parameters configured', { fps: video.framesPerSecond, intervalMs });

  await processVideoService.processVideoBatch({
    videoId: video.videoId,
    processingId: video.processingId,
    inputS3Uri: video.inputS3Url,
    outputS3Uri: video.outputS3Url,
    intervalMs,
    format: video.format,
    clientId: video.clientId,
    email: video.email,
    personName: video.userName,
  });
}
