"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessVideoController = void 0;
const tsyringe_1 = require("tsyringe");
const monitoring_1 = require("../../infrastructure/monitoring");
const MIN_INTERVAL_MS = 100;
const MAX_INTERVAL_MS = 60000;
const DEFAULT_INTERVAL_MS = 1000;
let ProcessVideoController = class ProcessVideoController {
    service;
    constructor(service) {
        this.service = service;
    }
    async process(req, res) {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        monitoring_1.logger.info({ type: 'controller.request', requestId }, 'Request received');
        monitoring_1.logger.info({ type: 'controller.file', requestId, fileName: req.file?.filename, fileSize: req.file?.size }, 'File uploaded');
        try {
            if (!req.file) {
                monitoring_1.logger.warn({ type: 'controller.error', requestId }, 'No file provided');
                res.status(400).json({ error: 'No video file provided' });
                return;
            }
            const intervalMs = Number(req.body.interval_ms || DEFAULT_INTERVAL_MS);
            const format = String(req.body.format || 'jpg').toLowerCase();
            if (intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS) {
                monitoring_1.logger.warn({ type: 'controller.error', requestId }, 'interval_ms out of range');
                res.status(400).json({
                    error: `interval_ms must be between ${MIN_INTERVAL_MS} and ${MAX_INTERVAL_MS}`,
                });
                return;
            }
            monitoring_1.logger.info({ type: 'controller.params', requestId, intervalMs, format }, 'Processing parameters');
            monitoring_1.logger.info({ type: 'controller.processing', requestId }, 'Starting processing');
            const startTime = Date.now();
            // For direct HTTP upload (not via RabbitMQ), use default values
            const jobId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const outputS3Prefix = 'output/local';
            const result = await this.service.processVideo({
                file: req.file.filename,
                intervalMs,
                format,
                jobId,
                outputS3Prefix,
            });
            monitoring_1.logger.info({ type: 'controller.completed', requestId, durationMs: Date.now() - startTime }, 'Processing completed');
            monitoring_1.logger.info({ type: 'controller.result', requestId, frames: result.frames }, `${result.frames} frames extracted`);
            res.json(result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            (0, monitoring_1.logError)(error, 'ProcessVideoController', { requestId });
            res.status(500).json({ error: message });
        }
    }
};
exports.ProcessVideoController = ProcessVideoController;
exports.ProcessVideoController = ProcessVideoController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)('ProcessVideoService')),
    __metadata("design:paramtypes", [Object])
], ProcessVideoController);
//# sourceMappingURL=process-video.controller.js.map