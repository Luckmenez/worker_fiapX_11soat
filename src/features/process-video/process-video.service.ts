import path from 'path';
import fs from 'fs';
import { inject, injectable } from 'tsyringe';
import { IProcessVideoService } from './process-video.service.interface';
import { IFfmpegService } from '../ffmpeg/ffmpeg.service.interface';
import { RabbitMQQueueService } from '../../infrastructure/broker/rabbitmq-queue.service';
import { IS3Gateway } from '../../infrastructure/gateways/s3.gateway.interface';
import { IEmailService } from '../../infrastructure/notifications';
import {
  ProcessVideoOptions,
  ProcessVideoResult,
  ProcessVideoBatchOptions,
  ProcessVideoBatchResult,
} from '../../@types/process-video.types';
import {
  safeJoin,
  createTempDir,
  removeDir,
  removeFile,
  zipDirectory,
  ensureDir,
} from '../../shared/utils';
import {
  logVideoProcessing,
  logBatchProcessing,
  logFFmpeg,
  logError,
} from '../../infrastructure/monitoring';

const INPUT_DIR = path.resolve('./input');
const OUTPUT_DIR = path.resolve('./output');

@injectable()
export class ProcessVideoService implements IProcessVideoService {
  constructor(
    @inject('FfmpegService')
    private readonly ffmpegService: IFfmpegService,
    @inject('RabbitMQQueueService')
    private readonly queueService: RabbitMQQueueService,
    @inject('S3Gateway')
    private readonly s3Gateway: IS3Gateway,
    @inject('EmailService')
    private readonly emailService: IEmailService
  ) {
    ensureDir(INPUT_DIR);
    ensureDir(OUTPUT_DIR);
  }

  async processVideo(options: ProcessVideoOptions): Promise<ProcessVideoResult> {
    const { file, intervalMs = 1000, format = 'jpg', jobId, outputS3Prefix } = options;

    const startedAt = Date.now();
    const tmpDir = createTempDir('frames-');
    let localVideoPath: string | null = null;
    let zipPath: string | null = null;

    try {
      // STEP 1: Download video from S3
      logVideoProcessing(jobId, 'download', 'Downloading video from S3', { step: '1/5' });
      const downloadStartTime = Date.now();

      const videoFileName = this.extractFilenameFromUrl(file);
      localVideoPath = safeJoin(INPUT_DIR, `${jobId}_${videoFileName}`);

      await this.s3Gateway.downloadFromUrl({
        url: file,
        destinationPath: localVideoPath,
      });

      const fileStats = fs.statSync(localVideoPath);
      logVideoProcessing(jobId, 'download', `Download completed in ${Date.now() - downloadStartTime}ms`, {
        sizeMB: (fileStats.size / 1e6).toFixed(2),
        durationMs: Date.now() - downloadStartTime,
      });

      // STEP 2: Extract frames with FFmpeg
      logVideoProcessing(jobId, 'ffmpeg', 'Extracting frames via FFmpeg');
      const ffmpegStartTime = Date.now();

      const { frames } = await this.ffmpegService.extractFrames({
        inputPath: localVideoPath,
        outputDir: tmpDir,
        intervalMs,
        format,
      });

      logFFmpeg(jobId, `FFmpeg completed - ${frames.length} frames extracted`, { frames: frames.length, durationMs: Date.now() - ffmpegStartTime });

      // STEP 3: Create ZIP archive
      const zipName = `${jobId}_frames_interval_${intervalMs}ms.zip`;
      zipPath = path.join(OUTPUT_DIR, zipName);

      logVideoProcessing(jobId, 'zip', `Creating ZIP archive: ${zipName}`, { zipName });
      const zipStartTime = Date.now();

      await zipDirectory(tmpDir, zipPath);

      const zipStats = fs.statSync(zipPath);
      logVideoProcessing(jobId, 'zip.completed', `ZIP completed in ${Date.now() - zipStartTime}ms`, { sizeMB: (zipStats.size / 1e6).toFixed(2), durationMs: Date.now() - zipStartTime });

      // STEP 4: Upload ZIP to S3
      logVideoProcessing(jobId, 'upload', 'Uploading ZIP to S3');
      const uploadStartTime = Date.now();

      const s3Key = `${outputS3Prefix}/${zipName}`;
      await this.s3Gateway.uploadFile({
        filePath: zipPath,
        s3Key,
        contentType: 'application/zip',
      });

      logVideoProcessing(jobId, 'upload.completed', `Upload completed in ${Date.now() - uploadStartTime}ms`, { durationMs: Date.now() - uploadStartTime });

      // STEP 5: Notify completion
      const durationMs = Date.now() - startedAt;
      logVideoProcessing(jobId, 'completed', `Process completed in ${durationMs}ms`, { durationMs, frames: frames.length });

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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logError(error, 'ProcessVideoService.processVideo', { jobId });

      await this.queueService.publishVideoCompleted({
        jobId: jobId || 'unknown',
        status: 'FAILED',
        error: errorMsg,
      });

      throw error;
    } finally {
      // Cleanup local files
      logVideoProcessing(jobId, 'cleanup', 'Cleaning up local files');
      removeDir(tmpDir);
      if (localVideoPath && fs.existsSync(localVideoPath)) {
        removeFile(localVideoPath);
      }
      if (zipPath && fs.existsSync(zipPath)) {
        removeFile(zipPath);
      }
      logVideoProcessing(jobId, 'cleanup.completed', 'Cleanup completed');
    }
  }

  /**
   * Extract filename from S3 presigned URL
   */
  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      const filename = parts[parts.length - 1] || 'video.mp4';
      return filename;
    } catch {
      return 'video.mp4';
    }
  }

  /**
   * Process multiple videos from a batch
   * Downloads videos from S3 input folder, processes each one, and uploads results to S3 output folder
   */
  async processVideoBatch(options: ProcessVideoBatchOptions): Promise<ProcessVideoBatchResult> {
    const { videoId, processingId, inputS3Uri, outputS3Uri, intervalMs, format, email, personName } = options;

    const startedAt = Date.now();
    const tempInputDir = createTempDir(`batch-input-${videoId}-`);
    const tempFramesDir = createTempDir(`batch-frames-${videoId}-`);

    let totalFrames = 0;
    const zipFiles: string[] = [];
    let videosProcessed = 0;

    try {
      // STEP 1: Download all videos from S3 input folder
      logBatchProcessing(videoId, 'Downloading videos from S3', { step: '1/5' });
      const downloadStartTime = Date.now();

      const downloadedVideos = await this.s3Gateway.downloadFolder(inputS3Uri, tempInputDir);

      if (downloadedVideos.length === 0) {
        throw new Error(`No videos found in ${inputS3Uri}`);
      }

      logBatchProcessing(videoId, `Downloaded ${downloadedVideos.length} videos in ${Date.now() - downloadStartTime}ms`, { step: '1/5', count: downloadedVideos.length, durationMs: Date.now() - downloadStartTime });

      // STEP 2-4: Process each video
      for (const videoPath of downloadedVideos) {
        const videoFileName = path.basename(videoPath);
        const videoBaseName = path.parse(videoFileName).name;
        const videoTempFramesDir = path.join(tempFramesDir, videoBaseName);

        ensureDir(videoTempFramesDir);

        try {
          logBatchProcessing(videoId, `Processing video ${videosProcessed + 1}/${downloadedVideos.length}: ${videoFileName}`, { step: '2/5', current: videosProcessed + 1, total: downloadedVideos.length, videoFileName });

          // Extract frames
          const ffmpegStartTime = Date.now();
          const { frames } = await this.ffmpegService.extractFrames({
            inputPath: videoPath,
            outputDir: videoTempFramesDir,
            intervalMs,
            format,
          });

          totalFrames += frames.length;
          logFFmpeg(videoId, `Extracted ${frames.length} frames in ${Date.now() - ffmpegStartTime}ms`, { frames: frames.length, durationMs: Date.now() - ffmpegStartTime });

          // STEP 3: Create ZIP
          logBatchProcessing(videoId, `Creating ZIP for ${videoFileName}`, { step: '3/5', videoFileName });
          const zipStartTime = Date.now();

          const zipName = `${videoBaseName}_frames_interval_${intervalMs}ms.zip`;
          const zipPath = path.join(OUTPUT_DIR, zipName);

          await zipDirectory(videoTempFramesDir, zipPath);

          const zipStats = fs.statSync(zipPath);
          logBatchProcessing(videoId, `ZIP created in ${Date.now() - zipStartTime}ms`, { step: '3/5', sizeMB: (zipStats.size / 1e6).toFixed(2), durationMs: Date.now() - zipStartTime });

          // STEP 4: Upload ZIP to S3
          logBatchProcessing(videoId, `Uploading ZIP to S3: ${zipName}`, { step: '4/5', zipName });
          const uploadStartTime = Date.now();

          const s3Key = await this.s3Gateway.uploadFileToUri(zipPath, outputS3Uri, 'application/zip');
          zipFiles.push(s3Key);

          logBatchProcessing(videoId, `Upload completed in ${Date.now() - uploadStartTime}ms`, { step: '4/5', durationMs: Date.now() - uploadStartTime });

          // Cleanup individual video files
          removeFile(videoPath);
          removeFile(zipPath);
          removeDir(videoTempFramesDir);

          videosProcessed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logError(error, 'ProcessVideoService.processVideoBatch.video', { videoId, videoFileName });
          // Continue processing other videos
        }
      }

      // STEP 5: Notify completion
      const durationMs = Date.now() - startedAt;
      logBatchProcessing(videoId, `Batch completed in ${durationMs}ms`, { step: '5/5', videosProcessed, totalFrames, durationMs });

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

          logBatchProcessing(videoId, 'Success email sent', { email });
        } catch (emailError) {
          // Log but don't fail the whole process
          logError(emailError, 'ProcessVideoService.sendSuccessEmail', { videoId, email });
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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logError(error, 'ProcessVideoService.processVideoBatch', { videoId });

      await this.queueService.publishVideoCompleted({
        jobId: videoId,
        status: 'FAILED',
        error: errorMsg,
      });

      throw error;
    } finally {
      // Cleanup
      logBatchProcessing(videoId, 'Cleaning up temporary files', { step: 'cleanup' });
      removeDir(tempInputDir);
      removeDir(tempFramesDir);
      logBatchProcessing(videoId, 'Cleanup completed', { step: 'cleanup' });
    }
  }
}
