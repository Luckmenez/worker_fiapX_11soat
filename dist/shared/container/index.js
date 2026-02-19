"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = void 0;
const tsyringe_1 = require("tsyringe");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return tsyringe_1.container; } });
const ffmpeg_service_1 = require("../../features/ffmpeg/ffmpeg.service");
const process_video_service_1 = require("../../features/process-video/process-video.service");
const rabbitmq_queue_service_1 = require("../../infrastructure/broker/rabbitmq-queue.service");
const s3_gateway_1 = require("../../infrastructure/gateways/s3.gateway");
const notifications_1 = require("../../infrastructure/notifications");
const health_check_use_case_1 = require("../../application/use-cases/health-check.use-case");
tsyringe_1.container.registerSingleton('FfmpegService', ffmpeg_service_1.FfmpegService);
tsyringe_1.container.registerSingleton('ProcessVideoService', process_video_service_1.ProcessVideoService);
tsyringe_1.container.registerSingleton('RabbitMQQueueService', rabbitmq_queue_service_1.RabbitMQQueueService);
tsyringe_1.container.registerSingleton('S3Gateway', s3_gateway_1.S3Gateway);
tsyringe_1.container.registerSingleton('EmailService', notifications_1.EmailService);
tsyringe_1.container.registerSingleton(health_check_use_case_1.HealthCheckUseCase);
//# sourceMappingURL=index.js.map