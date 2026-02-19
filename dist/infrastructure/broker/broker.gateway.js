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
Object.defineProperty(exports, "__esModule", { value: true });
exports.rabbitmqClient = void 0;
const amqp = __importStar(require("amqplib"));
const monitoring_1 = require("../monitoring");
class RabbitMQClient {
    static instance;
    connection = null;
    channel = null;
    isConnecting = false;
    constructor() { }
    static getInstance() {
        if (!RabbitMQClient.instance) {
            RabbitMQClient.instance = new RabbitMQClient();
        }
        return RabbitMQClient.instance;
    }
    async connect() {
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
            (0, monitoring_1.logRabbitMQ)('connection.connecting', 'Connecting to RabbitMQ');
            const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            this.connection = conn;
            conn.on('error', (err) => {
                (0, monitoring_1.logError)(err, 'RabbitMQ.connection');
                this.handleConnectionError();
            });
            conn.on('close', () => {
                (0, monitoring_1.logRabbitMQ)('connection.closed', 'Connection closed');
                this.handleConnectionError();
            });
            const ch = await conn.createChannel();
            this.channel = ch;
            ch.on('error', (err) => {
                (0, monitoring_1.logError)(err, 'RabbitMQ.channel');
            });
            ch.on('close', () => {
                (0, monitoring_1.logRabbitMQ)('channel.closed', 'Channel closed');
                this.channel = null;
            });
            await this.assertQueues();
            (0, monitoring_1.logRabbitMQ)('connection.success', 'Connected successfully');
            this.isConnecting = false;
            return ch;
        }
        catch (error) {
            this.isConnecting = false;
            this.connection = null;
            this.channel = null;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            (0, monitoring_1.logError)(error, 'RabbitMQ.connect');
            throw new Error(`RabbitMQ connection failed: ${errorMessage}`);
        }
    }
    async assertQueues() {
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
        await this.channel.assertQueue(process.env.BATCH_VIDEO_PROCESSING_QUEUE || 'batch.video.processing', {
            durable: true,
            deadLetterExchange: dlxName,
            deadLetterRoutingKey: 'failed',
        });
        // Video Completed Queue (sem DLX pois é apenas notificação)
        await this.channel.assertQueue(process.env.VIDEO_COMPLETED_QUEUE || 'video.completed', {
            durable: true,
        });
        (0, monitoring_1.logRabbitMQ)('queues.asserted', 'All queues and DLX configured', {
            dlx: dlxName,
            dlq: dlqName,
        });
    }
    async getChannel() {
        if (!this.channel) {
            return await this.connect();
        }
        return this.channel;
    }
    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            (0, monitoring_1.logRabbitMQ)('connection.close', 'Connection closed gracefully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            (0, monitoring_1.logError)(error, 'RabbitMQ.close');
        }
    }
    handleConnectionError() {
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
    }
    async waitForConnection(maxRetries = 10) {
        let retries = 0;
        while (this.isConnecting && retries < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            retries++;
        }
    }
}
exports.rabbitmqClient = RabbitMQClient.getInstance();
//# sourceMappingURL=broker.gateway.js.map