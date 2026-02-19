import { injectable } from 'tsyringe';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import amqp from 'amqplib';
import { Client } from '@elastic/elasticsearch';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    s3: ServiceStatus;
    rabbitmq: ServiceStatus;
    elasticsearch: ServiceStatus;
    ffmpeg: ServiceStatus;
  };
  uptime: number;
  version: string;
  environment: string;
}

interface ServiceStatus {
  status: 'ok' | 'error' | 'disabled';
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

@injectable()
export class HealthCheckUseCase {
  private s3Client: S3Client;
  private elasticsearchClient: Client | null = null;

  constructor() {
    // S3 Client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    // Elasticsearch Client (optional)
    if (process.env.ELASTICSEARCH_ENABLED === 'true') {
      this.elasticsearchClient = new Client({
        node: `http://${process.env.ELASTICSEARCH_HOST || 'localhost'}:${process.env.ELASTICSEARCH_PORT || '9200'}`,
        requestTimeout: 3000,
      });
    }
  }

  async execute(): Promise<HealthCheckResult> {
    const [s3Status, rabbitmqStatus, elasticsearchStatus, ffmpegStatus] = await Promise.all([
      this.checkS3(),
      this.checkRabbitMQ(),
      this.checkElasticsearch(),
      this.checkFFmpeg(),
    ]);

    const services = {
      s3: s3Status,
      rabbitmq: rabbitmqStatus,
      elasticsearch: elasticsearchStatus,
      ffmpeg: ffmpegStatus,
    };

    const status = this.determineOverallStatus(services);

    return {
      status,
      timestamp: new Date().toISOString(),
      services,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  private async checkS3(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      // Tenta listar buckets ou fazer ping no S3
      const command = new ListBucketsCommand({});
      const response = await this.s3Client.send(command);
      const responseTime = Date.now() - start;

      const bucket = process.env.AWS_S3_BUCKET;
      const bucketExists = response.Buckets?.some((b) => b.Name === bucket) || false;

      return {
        status: 'ok',
        responseTime,
        details: {
          bucket: bucket || 'not-configured',
          bucketExists,
          region: process.env.AWS_REGION || 'us-east-1',
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          bucket: process.env.AWS_S3_BUCKET || 'not-configured',
          region: process.env.AWS_REGION || 'us-east-1',
        },
      };
    }
  }

  private async checkRabbitMQ(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
      const connection = await amqp.connect(rabbitUrl);

      const channel = await connection.createChannel();

      // Verifica se as filas existem
      const videoQueue = process.env.VIDEO_PROCESSING_QUEUE || 'video.processing';
      const batchQueue = process.env.BATCH_VIDEO_PROCESSING_QUEUE || 'batch.video.processing';
      const dlq = 'video.processing.dlq';

      const [videoQueueInfo, batchQueueInfo, dlqInfo] = await Promise.all([
        channel.checkQueue(videoQueue).catch(() => null),
        channel.checkQueue(batchQueue).catch(() => null),
        channel.checkQueue(dlq).catch(() => null),
      ]);

      await channel.close();
      await connection.close();

      const responseTime = Date.now() - start;

      return {
        status: 'ok',
        responseTime,
        details: {
          queues: {
            video: {
              name: videoQueue,
              exists: videoQueueInfo !== null,
              messages: videoQueueInfo?.messageCount || 0,
            },
            batch: {
              name: batchQueue,
              exists: batchQueueInfo !== null,
              messages: batchQueueInfo?.messageCount || 0,
            },
            dlq: {
              name: dlq,
              exists: dlqInfo !== null,
              messages: dlqInfo?.messageCount || 0,
            },
          },
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          url: process.env.RABBITMQ_URL ? 'configured' : 'not-configured',
        },
      };
    }
  }

  private async checkElasticsearch(): Promise<ServiceStatus> {
    if (!this.elasticsearchClient) {
      return {
        status: 'disabled',
        details: {
          enabled: false,
          reason: 'ELASTICSEARCH_ENABLED is not set to true',
        },
      };
    }

    const start = Date.now();
    try {
      const health = await this.elasticsearchClient.cluster.health();
      const responseTime = Date.now() - start;

      return {
        status: 'ok',
        responseTime,
        details: {
          clusterName: health.cluster_name,
          clusterStatus: health.status,
          numberOfNodes: health.number_of_nodes,
          activeShards: health.active_shards,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          host: process.env.ELASTICSEARCH_HOST || 'localhost',
          port: process.env.ELASTICSEARCH_PORT || '9200',
        },
      };
    }
  }

  private async checkFFmpeg(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Verifica se o FFmpeg está instalado
      const { stdout } = await execAsync('ffmpeg -version');
      const responseTime = Date.now() - start;

      // Extrai a versão do FFmpeg
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        status: 'ok',
        responseTime,
        details: {
          version,
          available: true,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'FFmpeg not found or not executable',
        details: {
          available: false,
          message: 'FFmpeg is required for video processing. Please install it.',
        },
      };
    }
  }

  private determineOverallStatus(
    services: HealthCheckResult['services']
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalServices = {
      s3: services.s3,
      rabbitmq: services.rabbitmq,
      ffmpeg: services.ffmpeg,
    };

    const optionalServices = {
      elasticsearch: services.elasticsearch,
    };

    // Verifica serviços críticos
    const criticalStatuses = Object.values(criticalServices).map((s) => s.status);
    const hasCriticalError = criticalStatuses.some((s) => s === 'error');

    if (hasCriticalError) {
      return 'unhealthy';
    }

    // Verifica serviços opcionais
    const hasOptionalError =
      optionalServices.elasticsearch.status === 'error';

    if (hasOptionalError) {
      return 'degraded';
    }

    // Todos os serviços estão ok ou disabled
    return 'healthy';
  }

  async cleanup(): Promise<void> {
    try {
      if (this.elasticsearchClient) {
        await this.elasticsearchClient.close();
      }
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }
}
