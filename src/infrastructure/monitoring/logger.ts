import pino from 'pino';
import pinoElasticsearch from 'pino-elasticsearch';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const elasticsearchEnabled =
  process.env.ELASTICSEARCH_ENABLED === 'true' &&
  process.env.ELASTICSEARCH_HOST &&
  process.env.ELASTICSEARCH_PORT;

/**
 * Create Pino logger with Elasticsearch integration
 */
function createLogger() {
  const baseConfig: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: 'worker-fiapx-11soat',
      env: process.env.NODE_ENV || 'development',
    },
  };

  // Development: pretty print to console
  if (isDevelopment && !elasticsearchEnabled) {
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    });
  }

  // Production with Elasticsearch
  if (elasticsearchEnabled) {
    const elasticsearchUrl = `http://${process.env.ELASTICSEARCH_HOST}:${process.env.ELASTICSEARCH_PORT}`;

    const streamToElasticsearch = pinoElasticsearch({
      index: 'worker-logs',
      node: elasticsearchUrl,
      esVersion: 8,
      flushBytes: 1000,
      'es-version': 8,
    });

    const streams: pino.StreamEntry[] = [
      { stream: streamToElasticsearch },
    ];

    // Also log to console in production for debugging
    if (isDevelopment) {
      streams.push({
        stream: pino.destination(1), // stdout
      });
    }

    return pino(baseConfig, pino.multistream(streams));
  }

  // Fallback: simple console logging
  return pino(baseConfig);
}

export const logger = createLogger();

/**
 * Log helper for video processing
 */
export function logVideoProcessing(
  videoId: string,
  step: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      type: 'video.processing',
      videoId,
      step,
      ...metadata,
    },
    message
  );
}

/**
 * Log helper for batch processing
 */
export function logBatchProcessing(
  batchId: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      type: 'batch.processing',
      batchId,
      ...metadata,
    },
    message
  );
}

/**
 * Log helper for S3 operations
 */
export function logS3Operation(
  operation: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      type: 's3.operation',
      operation,
      ...metadata,
    },
    message
  );
}

/**
 * Log helper for RabbitMQ operations
 */
export function logRabbitMQ(
  operation: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      type: 'rabbitmq.operation',
      operation,
      ...metadata,
    },
    message
  );
}

/**
 * Log helper for FFmpeg operations
 */
export function logFFmpeg(
  videoId: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      type: 'ffmpeg.operation',
      videoId,
      ...metadata,
    },
    message
  );
}

/**
 * Log error with context
 */
export function logError(
  error: Error | unknown,
  context: string,
  metadata?: Record<string, unknown>
) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(
    {
      type: 'error',
      context,
      error: errorMessage,
      stack: errorStack,
      ...metadata,
    },
    `Error in ${context}: ${errorMessage}`
  );
}
