"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
require("./shared/container");
const routes_1 = require("./routes");
const health_routes_1 = require("./infrastructure/routes/health.routes");
const broker_gateway_1 = require("./infrastructure/broker/broker.gateway");
const video_processing_consumer_1 = require("./infrastructure/broker/video-processing.consumer");
const batch_video_processing_consumer_1 = require("./infrastructure/broker/batch-video-processing.consumer");
const dead_letter_consumer_1 = require("./infrastructure/broker/dead-letter.consumer");
const monitoring_1 = require("./infrastructure/monitoring");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
// Health check routes
app.use('/health', health_routes_1.healthRoutes);
// Video processing routes
app.use('/videos', routes_1.processVideoRoutes);
async function bootstrap() {
    try {
        await broker_gateway_1.rabbitmqClient.connect();
        // Start single video processing consumer
        await (0, video_processing_consumer_1.startVideoProcessingConsumer)();
        (0, monitoring_1.logRabbitMQ)('bootstrap', 'Video processing consumer started');
        // Start batch video processing consumer
        await (0, batch_video_processing_consumer_1.startBatchVideoProcessingConsumer)();
        (0, monitoring_1.logRabbitMQ)('bootstrap', 'Batch video processing consumer started');
        // Start dead letter consumer (handles failed messages after max retries)
        await (0, dead_letter_consumer_1.startDeadLetterConsumer)();
        (0, monitoring_1.logRabbitMQ)('bootstrap', 'Dead Letter Queue consumer started');
        monitoring_1.logger.info({ type: 'bootstrap.success' }, 'All RabbitMQ consumers started successfully');
    }
    catch (error) {
        (0, monitoring_1.logError)(error, 'Bootstrap');
    }
    app.listen(PORT, () => {
        monitoring_1.logger.info({
            type: 'server.start',
            port: PORT,
            env: process.env.NODE_ENV || 'development',
        }, `Server running on port ${PORT}`);
    });
}
bootstrap();
//# sourceMappingURL=main.js.map