import * as amqp from 'amqplib';

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
      console.log('[RabbitMQ] Connecting to RabbitMQ...');

      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      this.connection = conn;

      conn.on('error', (err: Error) => {
        console.error('[RabbitMQ] Connection error:', err.message);
        this.handleConnectionError();
      });

      conn.on('close', () => {
        console.warn('[RabbitMQ] Connection closed');
        this.handleConnectionError();
      });

      const ch = await conn.createChannel();
      this.channel = ch;

      ch.on('error', (err: Error) => {
        console.error('[RabbitMQ] Channel error:', err.message);
      });

      ch.on('close', () => {
        console.warn('[RabbitMQ] Channel closed');
        this.channel = null;
      });

      await this.assertQueues();

      console.log('✅ [RabbitMQ] Connected successfully');

      this.isConnecting = false;
      return ch;
    } catch (error) {
      this.isConnecting = false;
      this.connection = null;
      this.channel = null;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RabbitMQ] Failed to connect: ${errorMessage}`);

      throw new Error(`RabbitMQ connection failed: ${errorMessage}`);
    }
  }

  private async assertQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not available');
    }

    await this.channel.assertQueue(process.env.VIDEO_PROCESSING_QUEUE || 'video.processing', {
      durable: true,
    });

    await this.channel.assertQueue(process.env.VIDEO_COMPLETED_QUEUE || 'video.completed', {
      durable: true,
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

      console.log('[RabbitMQ] Connection closed gracefully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RabbitMQ] Error closing connection: ${errorMessage}`);
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
