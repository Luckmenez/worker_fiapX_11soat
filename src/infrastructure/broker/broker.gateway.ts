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

    const dlxName = 'video.processing.dlx';
    const dlqName = 'video.processing.dlq';

    await this.channel.assertExchange(dlxName, 'direct', { durable: true });

    await this.channel.assertQueue(dlqName, {
      durable: true,
    });

    await this.channel.bindQueue(dlqName, dlxName, 'failed');

    await this.channel.assertQueue(process.env.VIDEO_PROCESSING_QUEUE || 'video.processing', {
      durable: true,
      deadLetterExchange: dlxName,
      deadLetterRoutingKey: 'failed',
    });

    await this.channel.assertQueue(
      process.env.BATCH_VIDEO_PROCESSING_QUEUE || 'batch.video.processing',
      {
        durable: true,
        deadLetterExchange: dlxName,
        deadLetterRoutingKey: 'failed',
      }
    );

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
