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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessVideoService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const tsyringe_1 = require("tsyringe");
const rabbitmq_queue_service_1 = require("../../infrastructure/broker/rabbitmq-queue.service");
const utils_1 = require("../../shared/utils");
const monitoring_1 = require("../../infrastructure/monitoring");
const INPUT_DIR = path_1.default.resolve('./input');
const OUTPUT_DIR = path_1.default.resolve('./output');
let ProcessVideoService = class ProcessVideoService {
    ffmpegService;
    queueService;
    s3Gateway;
    emailService;
    constructor(ffmpegService, queueService, s3Gateway, emailService) {
        this.ffmpegService = ffmpegService;
        this.queueService = queueService;
        this.s3Gateway = s3Gateway;
        this.emailService = emailService;
        (0, utils_1.ensureDir)(INPUT_DIR);
        (0, utils_1.ensureDir)(OUTPUT_DIR);
    }
    async processVideo(options) {
        const { file, intervalMs = 1000, format = 'jpg', jobId, outputS3Prefix } = options;
        const startedAt = Date.now();
        const tmpDir = (0, utils_1.createTempDir)('frames-');
        let localVideoPath = null;
        let zipPath = null;
        try {
            // STEP 1: Download video from S3
            (0, monitoring_1.logVideoProcessing)(jobId, 'download', 'Downloading video from S3', { step: '1/5' });
            const downloadStartTime = Date.now();
            const videoFileName = this.extractFilenameFromUrl(file);
            localVideoPath = (0, utils_1.safeJoin)(INPUT_DIR, `${jobId}_${videoFileName}`);
            await this.s3Gateway.downloadFromUrl({
                url: file,
                destinationPath: localVideoPath,
            });
            const fileStats = fs_1.default.statSync(localVideoPath);
            (0, monitoring_1.logVideoProcessing)(jobId, 'download', `Download completed in ${Date.now() - downloadStartTime}ms`, {
                sizeMB: (fileStats.size / 1e6).toFixed(2),
                durationMs: Date.now() - downloadStartTime,
            });
            // STEP 2: Extract frames with FFmpeg
            (0, monitoring_1.logVideoProcessing)(jobId, 'ffmpeg', 'Extracting frames via FFmpeg');
            const ffmpegStartTime = Date.now();
            const { frames } = await this.ffmpegService.extractFrames({
                inputPath: localVideoPath,
                outputDir: tmpDir,
                intervalMs,
                format,
            });
            (0, monitoring_1.logFFmpeg)(jobId, `FFmpeg completed - ${frames.length} frames extracted`, { frames: frames.length, durationMs: Date.now() - ffmpegStartTime });
            // STEP 3: Create ZIP archive
            const zipName = `${jobId}_frames_interval_${intervalMs}ms.zip`;
            zipPath = path_1.default.join(OUTPUT_DIR, zipName);
            (0, monitoring_1.logVideoProcessing)(jobId, 'zip', `Creating ZIP archive: ${zipName}`, { zipName });
            const zipStartTime = Date.now();
            await (0, utils_1.zipDirectory)(tmpDir, zipPath);
            const zipStats = fs_1.default.statSync(zipPath);
            (0, monitoring_1.logVideoProcessing)(jobId, 'zip.completed', `ZIP completed in ${Date.now() - zipStartTime}ms`, { sizeMB: (zipStats.size / 1e6).toFixed(2), durationMs: Date.now() - zipStartTime });
            // STEP 4: Upload ZIP to S3
            (0, monitoring_1.logVideoProcessing)(jobId, 'upload', 'Uploading ZIP to S3');
            const uploadStartTime = Date.now();
            const s3Key = `${outputS3Prefix}/${zipName}`;
            await this.s3Gateway.uploadFile({
                filePath: zipPath,
                s3Key,
                contentType: 'application/zip',
            });
            (0, monitoring_1.logVideoProcessing)(jobId, 'upload.completed', `Upload completed in ${Date.now() - uploadStartTime}ms`, { durationMs: Date.now() - uploadStartTime });
            // STEP 5: Notify completion
            const durationMs = Date.now() - startedAt;
            (0, monitoring_1.logVideoProcessing)(jobId, 'completed', `Process completed in ${durationMs}ms`, { durationMs, frames: frames.length });
            await this.queueService.publishVideoCompleted({
                jobId,
                status: 'COMPLETED',
                framesExtracted: frames.length,
            });
            return {
                ok: true,
                input: file,
                intervalMs,
                format,
                frames: frames.length,
                zipFile: zipName,
                zipPath: s3Key,
                durationMs,
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            (0, monitoring_1.logError)(error, 'ProcessVideoService.processVideo', { jobId });
            await this.queueService.publishVideoCompleted({
                jobId: jobId || 'unknown',
                status: 'FAILED',
                error: errorMsg,
            });
            throw error;
        }
        finally {
            // Cleanup local files
            (0, monitoring_1.logVideoProcessing)(jobId, 'cleanup', 'Cleaning up local files');
            (0, utils_1.removeDir)(tmpDir);
            if (localVideoPath && fs_1.default.existsSync(localVideoPath)) {
                (0, utils_1.removeFile)(localVideoPath);
            }
            if (zipPath && fs_1.default.existsSync(zipPath)) {
                (0, utils_1.removeFile)(zipPath);
            }
            (0, monitoring_1.logVideoProcessing)(jobId, 'cleanup.completed', 'Cleanup completed');
        }
    }
    /**
     * Extract filename from S3 presigned URL
     */
    extractFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const parts = pathname.split('/');
            const filename = parts[parts.length - 1] || 'video.mp4';
            return filename;
        }
        catch {
            return 'video.mp4';
        }
    }
    /**
     * Process multiple videos from a batch
     * Downloads videos from S3 input folder, processes each one, and uploads results to S3 output folder
     */
    async processVideoBatch(options) {
        const { videoId, processingId, inputS3Uri, outputS3Uri, intervalMs, format, email, personName } = options;
        const startedAt = Date.now();
        const tempInputDir = (0, utils_1.createTempDir)(`batch-input-${videoId}-`);
        const tempFramesDir = (0, utils_1.createTempDir)(`batch-frames-${videoId}-`);
        let totalFrames = 0;
        const zipFiles = [];
        let videosProcessed = 0;
        try {
            // STEP 1: Download all videos from S3 input folder
            (0, monitoring_1.logBatchProcessing)(videoId, 'Downloading videos from S3', { step: '1/5' });
            const downloadStartTime = Date.now();
            const downloadedVideos = await this.s3Gateway.downloadFolder(inputS3Uri, tempInputDir);
            if (downloadedVideos.length === 0) {
                throw new Error(`No videos found in ${inputS3Uri}`);
            }
            (0, monitoring_1.logBatchProcessing)(videoId, `Downloaded ${downloadedVideos.length} videos in ${Date.now() - downloadStartTime}ms`, { step: '1/5', count: downloadedVideos.length, durationMs: Date.now() - downloadStartTime });
            // STEP 2-4: Process each video
            for (const videoPath of downloadedVideos) {
                const videoFileName = path_1.default.basename(videoPath);
                const videoBaseName = path_1.default.parse(videoFileName).name;
                const videoTempFramesDir = path_1.default.join(tempFramesDir, videoBaseName);
                (0, utils_1.ensureDir)(videoTempFramesDir);
                try {
                    (0, monitoring_1.logBatchProcessing)(videoId, `Processing video ${videosProcessed + 1}/${downloadedVideos.length}: ${videoFileName}`, { step: '2/5', current: videosProcessed + 1, total: downloadedVideos.length, videoFileName });
                    // Extract frames
                    const ffmpegStartTime = Date.now();
                    const { frames } = await this.ffmpegService.extractFrames({
                        inputPath: videoPath,
                        outputDir: videoTempFramesDir,
                        intervalMs,
                        format,
                    });
                    totalFrames += frames.length;
                    (0, monitoring_1.logFFmpeg)(videoId, `Extracted ${frames.length} frames in ${Date.now() - ffmpegStartTime}ms`, { frames: frames.length, durationMs: Date.now() - ffmpegStartTime });
                    // STEP 3: Create ZIP
                    (0, monitoring_1.logBatchProcessing)(videoId, `Creating ZIP for ${videoFileName}`, { step: '3/5', videoFileName });
                    const zipStartTime = Date.now();
                    const zipName = `${videoBaseName}_frames_interval_${intervalMs}ms.zip`;
                    const zipPath = path_1.default.join(OUTPUT_DIR, zipName);
                    await (0, utils_1.zipDirectory)(videoTempFramesDir, zipPath);
                    const zipStats = fs_1.default.statSync(zipPath);
                    (0, monitoring_1.logBatchProcessing)(videoId, `ZIP created in ${Date.now() - zipStartTime}ms`, { step: '3/5', sizeMB: (zipStats.size / 1e6).toFixed(2), durationMs: Date.now() - zipStartTime });
                    // STEP 4: Upload ZIP to S3
                    (0, monitoring_1.logBatchProcessing)(videoId, `Uploading ZIP to S3: ${zipName}`, { step: '4/5', zipName });
                    const uploadStartTime = Date.now();
                    const s3Key = await this.s3Gateway.uploadFileToUri(zipPath, outputS3Uri, 'application/zip');
                    zipFiles.push(s3Key);
                    (0, monitoring_1.logBatchProcessing)(videoId, `Upload completed in ${Date.now() - uploadStartTime}ms`, { step: '4/5', durationMs: Date.now() - uploadStartTime });
                    // Cleanup individual video files
                    (0, utils_1.removeFile)(videoPath);
                    (0, utils_1.removeFile)(zipPath);
                    (0, utils_1.removeDir)(videoTempFramesDir);
                    videosProcessed++;
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    (0, monitoring_1.logError)(error, 'ProcessVideoService.processVideoBatch.video', { videoId, videoFileName });
                    // Continue processing other videos
                }
            }
            // STEP 5: Notify completion
            const durationMs = Date.now() - startedAt;
            (0, monitoring_1.logBatchProcessing)(videoId, `Batch completed in ${durationMs}ms`, { step: '5/5', videosProcessed, totalFrames, durationMs });
            await this.queueService.publishVideoCompleted({
                jobId: videoId,
                status: 'COMPLETED',
                framesExtracted: totalFrames,
            });
            // Send success email notification
            if (email) {
                try {
                    const processingTimeSeconds = Math.round(durationMs / 1000);
                    const minutes = Math.floor(processingTimeSeconds / 60);
                    const seconds = processingTimeSeconds % 60;
                    const processingTime = minutes > 0
                        ? `${minutes}min ${seconds}s`
                        : `${seconds}s`;
                    await this.emailService.sendProcessingCompleted(email, {
                        personName: personName || 'Cliente',
                        videoId,
                        fileName: `Lote de ${videosProcessed} vídeo(s)`,
                        framesExtracted: totalFrames,
                        processingTime,
                    });
                    (0, monitoring_1.logBatchProcessing)(videoId, 'Success email sent', { email });
                }
                catch (emailError) {
                    // Log but don't fail the whole process
                    (0, monitoring_1.logError)(emailError, 'ProcessVideoService.sendSuccessEmail', { videoId, email });
                }
            }
            return {
                videoId,
                processingId,
                ok: true,
                videosProcessed,
                totalFrames,
                zipFiles,
                durationMs,
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            (0, monitoring_1.logError)(error, 'ProcessVideoService.processVideoBatch', { videoId });
            await this.queueService.publishVideoCompleted({
                jobId: videoId,
                status: 'FAILED',
                error: errorMsg,
            });
            throw error;
        }
        finally {
            // Cleanup
            (0, monitoring_1.logBatchProcessing)(videoId, 'Cleaning up temporary files', { step: 'cleanup' });
            (0, utils_1.removeDir)(tempInputDir);
            (0, utils_1.removeDir)(tempFramesDir);
            (0, monitoring_1.logBatchProcessing)(videoId, 'Cleanup completed', { step: 'cleanup' });
        }
    }
};
exports.ProcessVideoService = ProcessVideoService;
exports.ProcessVideoService = ProcessVideoService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)('FfmpegService')),
    __param(1, (0, tsyringe_1.inject)('RabbitMQQueueService')),
    __param(2, (0, tsyringe_1.inject)('S3Gateway')),
    __param(3, (0, tsyringe_1.inject)('EmailService')),
    __metadata("design:paramtypes", [Object, rabbitmq_queue_service_1.RabbitMQQueueService, Object, Object])
], ProcessVideoService);
//# sourceMappingURL=process-video.service.js.map