"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logVideoProcessing = logVideoProcessing;
exports.logBatchProcessing = logBatchProcessing;
exports.logS3Operation = logS3Operation;
exports.logRabbitMQ = logRabbitMQ;
exports.logFFmpeg = logFFmpeg;
exports.logError = logError;
const pino_1 = __importDefault(require("pino"));
const pino_elasticsearch_1 = __importDefault(require("pino-elasticsearch"));
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const elasticsearchEnabled = process.env.ELASTICSEARCH_ENABLED === 'true' &&
    process.env.ELASTICSEARCH_HOST &&
    process.env.ELASTICSEARCH_PORT;
/**
 * Create Pino logger with Elasticsearch integration
 */
function createLogger() {
    const baseConfig = {
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
            level: (label) => {
                return { level: label };
            },
        },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
        base: {
            service: 'worker-fiapx-11soat',
            env: process.env.NODE_ENV || 'development',
        },
    };
    // Development: pretty print to console
    if (isDevelopment && !elasticsearchEnabled) {
        return (0, pino_1.default)({
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
        const streamToElasticsearch = (0, pino_elasticsearch_1.default)({
            index: 'worker-logs',
            node: elasticsearchUrl,
            esVersion: 8,
            flushBytes: 1000,
            'es-version': 8,
        });
        const streams = [
            { stream: streamToElasticsearch },
        ];
        // Also log to console in production for debugging
        if (isDevelopment) {
            streams.push({
                stream: pino_1.default.destination(1), // stdout
            });
        }
        return (0, pino_1.default)(baseConfig, pino_1.default.multistream(streams));
    }
    // Fallback: simple console logging
    return (0, pino_1.default)(baseConfig);
}
exports.logger = createLogger();
/**
 * Log helper for video processing
 */
function logVideoProcessing(videoId, step, message, metadata) {
    exports.logger.info({
        type: 'video.processing',
        videoId,
        step,
        ...metadata,
    }, message);
}
/**
 * Log helper for batch processing
 */
function logBatchProcessing(batchId, message, metadata) {
    exports.logger.info({
        type: 'batch.processing',
        batchId,
        ...metadata,
    }, message);
}
/**
 * Log helper for S3 operations
 */
function logS3Operation(operation, message, metadata) {
    exports.logger.info({
        type: 's3.operation',
        operation,
        ...metadata,
    }, message);
}
/**
 * Log helper for RabbitMQ operations
 */
function logRabbitMQ(operation, message, metadata) {
    exports.logger.info({
        type: 'rabbitmq.operation',
        operation,
        ...metadata,
    }, message);
}
/**
 * Log helper for FFmpeg operations
 */
function logFFmpeg(videoId, message, metadata) {
    exports.logger.info({
        type: 'ffmpeg.operation',
        videoId,
        ...metadata,
    }, message);
}
/**
 * Log error with context
 */
function logError(error, context, metadata) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    exports.logger.error({
        type: 'error',
        context,
        error: errorMessage,
        stack: errorStack,
        ...metadata,
    }, `Error in ${context}: ${errorMessage}`);
}
//# sourceMappingURL=logger.js.map