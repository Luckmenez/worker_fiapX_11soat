"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQQueueService = void 0;
const tsyringe_1 = require("tsyringe");
const broker_gateway_1 = require("./broker.gateway");
const monitoring_1 = require("../monitoring");
let RabbitMQQueueService = class RabbitMQQueueService {
    async publishVideoCompleted(message) {
        // const startTime = Date.now();
        try {
            const channel = await broker_gateway_1.rabbitmqClient.getChannel();
            const queue = process.env.VIDEO_COMPLETED_QUEUE || 'video.completed';
            const messageBuffer = Buffer.from(JSON.stringify(message));
            const sent = channel.sendToQueue(queue, messageBuffer, {
                persistent: true,
                contentType: 'application/json',
                timestamp: Date.now(),
            });
            if (!sent) {
                throw new Error('Failed to send message to queue (buffer full)');
            }
            // const duration = Date.now() - startTime;
            (0, monitoring_1.logRabbitMQ)('publish.completed', `Message published to ${queue}`, {
                queue,
                jobId: message.jobId,
                status: message.status,
                framesExtracted: message.framesExtracted,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            (0, monitoring_1.logError)(error, 'RabbitMQQueueService.publishVideoCompleted', { message });
            throw new Error(`RabbitMQ unavailable: ${errorMessage}`);
        }
    }
    async close() {
        await broker_gateway_1.rabbitmqClient.close();
    }
};
exports.RabbitMQQueueService = RabbitMQQueueService;
exports.RabbitMQQueueService = RabbitMQQueueService = __decorate([
    (0, tsyringe_1.injectable)()
], RabbitMQQueueService);
//# sourceMappingURL=rabbitmq-queue.service.js.map