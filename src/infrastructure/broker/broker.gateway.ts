import * as amqp from 'amqplib';
import { logRabbitMQ, logError } from '../monitoring';

class RabbitMQClient {
  private static instance: RabbitMQClient;
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnecting = false;

  private constructor() {}

  public static getInstance(): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient();
    }
    return RabbitMQClient.instance;
  }

  public async connect(): Promise<amqp.Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (this.isConnecting) {
      await this.waitForConnection();
      if (this.channel) {
        return this.channel;
      }
    }

    this.isConnecting = true;

    try {
      logRabbitMQ('connection.connecting', 'Connecting to RabbitMQ');

      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      this.connection = conn;

      conn.on('error', (err: Error) => {
        logError(err, 'RabbitMQ.connection');
        this.handleConnectionError();
      });

      conn.on('close', () => {
        logRabbitMQ('connection.closed', 'Connection closed');
        this.handleConnectionError();
      });

      const ch = await conn.createChannel();
      this.channel = ch;

      ch.on('error', (err: Error) => {
        logError(err, 'RabbitMQ.channel');
      });

      ch.on('close', () => {
        logRabbitMQ('channel.closed', 'Channel closed');
        this.channel = null;
      });

      await this.assertQueues();

      logRabbitMQ('connection.success', 'Connected successfully');

      this.isConnecting = false;
      return ch;
    } catch (error) {
      this.isConnecting = false;
      this.connection = null;
      this.channel = null;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(error, 'RabbitMQ.connect');

      throw new Error(`RabbitMQ connection failed: ${errorMessage}`);
    }
  }

  private async assertQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not available');
    }

    // Dead Letter Exchange (DLX) e Dead Letter Queue (DLQ)
    const dlxName = 'video.processing.dlx';
    const dlqName = 'video.processing.dlq';

    // 1. Criar Dead Letter Exchange
    await this.channel.assertExchange(dlxName, 'direct', { durable: true });

    // 2. Criar Dead Letter Queue (onde as mensagens falhas vão parar)
    await this.channel.assertQueue(dlqName, {
      durable: true,
    });

    // 3. Bind DLQ ao DLX
    await this.channel.bindQueue(dlqName, dlxName, 'failed');

    // 4. Filas principais com DLX configurado
    // Video Processing Queue - com retry máximo de 2x
    await this.channel.assertQueue(process.env.VIDEO_PROCESSING_QUEUE || 'video.processing', {
      durable: true,
      deadLetterExchange: dlxName,
      deadLetterRoutingKey: 'failed',
    });

    // Batch Video Processing Queue - com retry máximo de 2x
    await this.channel.assertQueue(
      process.env.BATCH_VIDEO_PROCESSING_QUEUE || 'batch.video.processing',
      {
        durable: true,
        deadLetterExchange: dlxName,
        deadLetterRoutingKey: 'failed',
      }
    );

    // Video Completed Queue (sem DLX pois é apenas notificação)
    await this.channel.assertQueue(process.env.VIDEO_COMPLETED_QUEUE || 'video.completed', {
      durable: true,
    });

    logRabbitMQ('queues.asserted', 'All queues and DLX configured', {
      dlx: dlxName,
      dlq: dlqName,
    });
  }

  public async getChannel(): Promise<amqp.Channel> {
    if (!this.channel) {
      return await this.connect();
    }
    return this.channel;
  }

  public async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      logRabbitMQ('connection.close', 'Connection closed gracefully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(error, 'RabbitMQ.close');
    }
  }

  private handleConnectionError(): void {
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
  }

  private async waitForConnection(maxRetries = 10): Promise<void> {
    let retries = 0;
    while (this.isConnecting && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }
  }
}

export const rabbitmqClient = RabbitMQClient.getInstance();
