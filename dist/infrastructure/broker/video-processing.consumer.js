"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startVideoProcessingConsumer = startVideoProcessingConsumer;
const container_1 = require("../../shared/container");
const broker_gateway_1 = require("./broker.gateway");
const monitoring_1 = require("../monitoring");
const QUEUE_NAME = process.env.VIDEO_PROCESSING_QUEUE || 'video.processing';
/**
 * Extract S3 prefix (folder path) from presigned URL
 */
function extractS3PrefixFromUrl(presignedUrl) {
    try {
        const url = new URL(presignedUrl);
        const pathname = url.pathname;
        // Remove leading slash and extract directory path
        const key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
        return key;
    }
    catch (error) {
        (0, monitoring_1.logError)(error, 'VideoProcessingConsumer.extractS3Prefix', { url: presignedUrl });
        return 'output';
    }
}
async function startVideoProcessingConsumer() {
    const channel = await broker_gateway_1.rabbitmqClient.getChannel();
    await channel.prefetch(1);
    (0, monitoring_1.logRabbitMQ)('consumer.start', `Listening on queue: ${QUEUE_NAME}`, { queue: QUEUE_NAME });
    channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg)
            return;
        const content = msg.content.toString();
        (0, monitoring_1.logRabbitMQ)('consumer.message', 'Received message', { messageLength: content.length });
        let payload;
        try {
            payload = JSON.parse(content);
        }
        catch {
            (0, monitoring_1.logError)(new Error('Failed to parse message'), 'VideoProcessingConsumer', { content });
            channel.nack(msg, false, false);
            return;
        }
        try {
            const processVideoService = container_1.container.resolve('ProcessVideoService');
            const intervalMs = payload.framesPerSecond > 0 ? Math.round(1000 / payload.framesPerSecond) : 1000;
            // Extract output S3 prefix from outputUrlStorage
            const outputS3Prefix = extractS3PrefixFromUrl(payload.outputUrlStorage);
            await processVideoService.processVideo({
                file: payload.inputUrlStorage,
                intervalMs,
                format: payload.format ?? 'jpg',
                jobId: payload.jobId,
                outputS3Prefix,
            });
            (0, monitoring_1.logRabbitMQ)('consumer.success', `Job ${payload.jobId} processed successfully`, { jobId: payload.jobId });
            channel.ack(msg);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            (0, monitoring_1.logError)(error, 'VideoProcessingConsumer', { jobId: payload.jobId });
            channel.nack(msg, false, false);
        }
    });
}
//# sourceMappingURL=video-processing.consumer.js.map