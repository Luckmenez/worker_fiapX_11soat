import { ConsumeMessage } from 'amqplib';
import { container } from 'tsyringe';
import { rabbitmqClient } from './broker.gateway';
import { BatchVideoProcessingMessageDTO } from './batch-video-processing.types';
import { VideoProcessingMessageDTO } from './broker.types';
import { IEmailService } from '../notifications';
import { logRabbitMQ, logError } from '../monitoring';

const DLQ_NAME = 'video.processing.dlq';

export async function startDeadLetterConsumer(): Promise<void> {
  try {
    const channel = await rabbitmqClient.getChannel();
    const emailService = container.resolve<IEmailService>('EmailService');

    logRabbitMQ('dlq.consumer.starting', `Starting DLQ consumer: ${DLQ_NAME}`);

    await channel.prefetch(1);

    channel.consume(
      DLQ_NAME,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        const content = msg.content.toString();
        const retryCount = (msg.properties.headers?.['x-delivery-count'] as number) || 0;

        logRabbitMQ('dlq.message.received', `DLQ message received`, {
          retryCount,
          routingKey: msg.fields.routingKey,
        });

        try {
          let payload: BatchVideoProcessingMessageDTO | VideoProcessingMessageDTO;

          try {
            payload = JSON.parse(content) as BatchVideoProcessingMessageDTO;
          } catch {
            payload = JSON.parse(content) as VideoProcessingMessageDTO;
          }

          if ('videos' in payload && 'person' in payload) {
            await handleBatchProcessingFailure(emailService, payload, retryCount);
          } else if ('jobId' in payload) {
            await handleIndividualProcessingFailure(emailService, payload, retryCount);
          } else {
            logError(new Error('Unknown message format'), 'DLQ.Consumer', { content });
          }

          channel.ack(msg);

          logRabbitMQ('dlq.message.processed', 'DLQ message processed and ACKed', {
            retryCount,
          });
        } catch (error) {
          logError(error, 'DLQ.Consumer', { content, retryCount });

          channel.nack(msg, false, false);

          logRabbitMQ('dlq.message.nacked', 'DLQ message NACKed (discarded)', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      {
        noAck: false,
      }
    );

    logRabbitMQ('dlq.consumer.started', `DLQ consumer started successfully`);
  } catch (error) {
    logError(error, 'DLQ.Consumer.Start');
    throw error;
  }
}

async function handleBatchProcessingFailure(
  emailService: IEmailService,
  payload: BatchVideoProcessingMessageDTO,
  retryCount: number
): Promise<void> {
  const { person, videos } = payload;

  logRabbitMQ('dlq.batch.failure', `Batch processing failed after ${retryCount} attempts`, {
    personEmail: person.email,
    videoCount: videos.length,
    retryCount,
  });

  const videoIds = videos.map((v) => v.id).join(', ');

  await emailService.sendProcessingFailed(person.email, {
    personName: person.name,
    videoId: videoIds,
    fileName: `Lote de ${videos.length} vídeo(s)`,
    error: 'Falha no processamento do lote de vídeos. Tente fazer upload novamente.',
    attemptCount: retryCount,
  });

  logRabbitMQ('dlq.batch.notification-sent', `Batch failure notification sent`, {
    personEmail: person.email,
    videoCount: videos.length,
  });
}

async function handleIndividualProcessingFailure(
  emailService: IEmailService,
  payload: VideoProcessingMessageDTO,
  retryCount: number
): Promise<void> {
  logRabbitMQ(
    'dlq.individual.failure',
    `Individual processing failed after ${retryCount} attempts`,
    {
      jobId: payload.jobId,
      retryCount,
    }
  );

  logError(
    new Error('Individual video processing failed - email not available in payload'),
    'DLQ.Individual',
    {
      jobId: payload.jobId,
      clientId: payload.clientId,
      retryCount,
    }
  );

  logRabbitMQ('dlq.individual.logged', `Individual failure logged (no email sent)`, {
    jobId: payload.jobId,
    clientId: payload.clientId,
  });
}
