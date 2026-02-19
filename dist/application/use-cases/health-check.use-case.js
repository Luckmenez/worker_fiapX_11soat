"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckUseCase = void 0;
const tsyringe_1 = require("tsyringe");
const client_s3_1 = require("@aws-sdk/client-s3");
const amqplib_1 = __importDefault(require("amqplib"));
const elasticsearch_1 = require("@elastic/elasticsearch");
let HealthCheckUseCase = class HealthCheckUseCase {
    s3Client;
    elasticsearchClient = null;
    constructor() {
        // S3 Client
        this.s3Client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        // Elasticsearch Client (optional)
        if (process.env.ELASTICSEARCH_ENABLED === 'true') {
            this.elasticsearchClient = new elasticsearch_1.Client({
                node: `http://${process.env.ELASTICSEARCH_HOST || 'localhost'}:${process.env.ELASTICSEARCH_PORT || '9200'}`,
                requestTimeout: 3000,
            });
        }
    }
    async execute() {
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
    async checkS3() {
        const start = Date.now();
        try {
            // Tenta listar buckets ou fazer ping no S3
            const command = new client_s3_1.ListBucketsCommand({});
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
        }
        catch (error) {
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
    async checkRabbitMQ() {
        const start = Date.now();
        try {
            const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
            const connection = await amqplib_1.default.connect(rabbitUrl);
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
        }
        catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                details: {
                    url: process.env.RABBITMQ_URL ? 'configured' : 'not-configured',
                },
            };
        }
    }
    async checkElasticsearch() {
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
        }
        catch (error) {
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
    async checkFFmpeg() {
        const start = Date.now();
        try {
            const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
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
        }
        catch (error) {
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
    determineOverallStatus(services) {
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
        const hasOptionalError = optionalServices.elasticsearch.status === 'error';
        if (hasOptionalError) {
            return 'degraded';
        }
        // Todos os serviços estão ok ou disabled
        return 'healthy';
    }
    async cleanup() {
        try {
            if (this.elasticsearchClient) {
                await this.elasticsearchClient.close();
            }
        }
        catch (error) {
            // Silently ignore cleanup errors
        }
    }
};
exports.HealthCheckUseCase = HealthCheckUseCase;
exports.HealthCheckUseCase = HealthCheckUseCase = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], HealthCheckUseCase);
//# sourceMappingURL=health-check.use-case.js.map