import { ConsumeMessage } from 'amqplib';
import { container } from 'tsyringe';
import { rabbitmqClient } from './broker.gateway';
import { BatchVideoProcessingMessageDTO } from './batch-video-processing.types';
import { VideoProcessingMessageDTO } from './broker.types';
import { IEmailService } from '../notifications';
import { logRabbitMQ, logError } from '../monitoring';

const DLQ_NAME = 'video.processing.dlq';
const MAX_RETRY_COUNT = 2;

/**
 * Consumer para Dead Letter Queue
 * Processa mensagens que falharam após MAX_RETRY_COUNT tentativas
 * Envia notificação por e-mail para o usuário informando a falha
 */
export async function startDeadLetterConsumer(): Promise<void> {
  try {
    const channel = await rabbitmqClient.getChannel();
    const emailService = container.resolve<IEmailService>('EmailService');

    logRabbitMQ('dlq.consumer.starting', `Starting DLQ consumer: ${DLQ_NAME}`);

    // Prefetch 1 para processar uma mensagem de cada vez
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
          // Tentar parsear como BatchVideoProcessingMessage primeiro
          let payload: BatchVideoProcessingMessageDTO | VideoProcessingMessageDTO;

          try {
            payload = JSON.parse(content) as BatchVideoProcessingMessageDTO;
          } catch {
            payload = JSON.parse(content) as VideoProcessingMessageDTO;
          }

          // Verificar se é batch ou individual
          if ('videos' in payload && 'person' in payload) {
            // Batch processing falhou
            await handleBatchProcessingFailure(emailService, payload, retryCount);
          } else if ('jobId' in payload) {
            // Individual processing falhou
            await handleIndividualProcessingFailure(emailService, payload, retryCount);
          } else {
            logError(new Error('Unknown message format'), 'DLQ.Consumer', { content });
          }

          // ACK a mensagem após processar
          channel.ack(msg);

          logRabbitMQ('dlq.message.processed', 'DLQ message processed and ACKed', {
            retryCount,
          });
        } catch (error) {
          logError(error, 'DLQ.Consumer', { content, retryCount });

          // NACK sem requeue - mensagem vai ser descartada
          // Não queremos reprocessar indefinidamente
          channel.nack(msg, false, false);

          logRabbitMQ('dlq.message.nacked', 'DLQ message NACKed (discarded)', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      {
        noAck: false, // Manual ACK
      }
    );

    logRabbitMQ('dlq.consumer.started', `DLQ consumer started successfully`);
  } catch (error) {
    logError(error, 'DLQ.Consumer.Start');
    throw error;
  }
}

/**
 * Trata falha de processamento em batch
 */
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

  // Enviar e-mail informando falha no processamento do lote
  const videoIds = videos.map((v) => v.id).join(', ');
  const firstVideo = videos[0];

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

/**
 * Trata falha de processamento individual
 */
async function handleIndividualProcessingFailure(
  emailService: IEmailService,
  payload: VideoProcessingMessageDTO,
  retryCount: number
): Promise<void> {
  logRabbitMQ('dlq.individual.failure', `Individual processing failed after ${retryCount} attempts`, {
    jobId: payload.jobId,
    retryCount,
  });

  // Para processamento individual, precisamos buscar o e-mail do usuário
  // Como não temos no payload, vamos logar o erro
  // Na prática, o payload deveria incluir o e-mail do usuário
  logError(
    new Error('Individual video processing failed - email not available in payload'),
    'DLQ.Individual',
    {
      jobId: payload.jobId,
      clientId: payload.clientId,
      retryCount,
    }
  );

  // TODO: Buscar e-mail do usuário pelo jobId/clientId no banco de dados da API
  // Por enquanto, apenas logamos a falha
  logRabbitMQ('dlq.individual.logged', `Individual failure logged (no email sent)`, {
    jobId: payload.jobId,
    clientId: payload.clientId,
  });
}
