import path from 'path';
import fs from 'fs';
import { inject, injectable } from 'tsyringe';
import { IProcessVideoService } from './process-video.service.interface';
import { IFfmpegService } from '../ffmpeg/ffmpeg.service.interface';
import { RabbitMQQueueService } from '../../infrastructure/broker/rabbitmq-queue.service';
import { ProcessVideoOptions, ProcessVideoResult } from '../../@types/process-video.types';
import {
  safeJoin,
  createTempDir,
  removeDir,
  removeFile,
  zipDirectory,
  ensureDir,
} from '../../shared/utils';

const INPUT_DIR = path.resolve('./input');
const OUTPUT_DIR = path.resolve('./output');

@injectable()
export class ProcessVideoService implements IProcessVideoService {
  constructor(
    @inject('FfmpegService')
    private readonly ffmpegService: IFfmpegService,
    @inject('RabbitMQQueueService')
    private readonly queueService: RabbitMQQueueService
  ) {
    ensureDir(INPUT_DIR);
    ensureDir(OUTPUT_DIR);
  }

  async processVideo(options: ProcessVideoOptions): Promise<ProcessVideoResult> {
    const { file, intervalMs = 1000, format = 'jpg' } = options;

    const inputPath = safeJoin(INPUT_DIR, file);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Arquivo de vídeo não encontrado: ${inputPath}`);
    }

    const fileStats = fs.statSync(inputPath);
    console.log(
      `[SERVICE] Iniciando processamento do vídeo: ${file} (${(fileStats.size / 1e6).toFixed(2)} MB)`
    );

    const tmpDir = createTempDir('frames-');

    const startedAt = Date.now();

    try {
      console.log(`[SERVICE] [STEP 1/3] Iniciando extração de frames via FFmpeg...`);
      const ffmpegStartTime = Date.now();

      const { frames } = await this.ffmpegService.extractFrames({
        inputPath,
        outputDir: tmpDir,
        intervalMs,
        format,
      });

      console.log(`[SERVICE] [STEP 1/3] FFmpeg concluído em ${Date.now() - ffmpegStartTime}ms`);
      console.log(`[SERVICE] [STEP 1/3] Frames extraídos: ${frames.length}`);

      const baseName = path.parse(file).name;
      const zipName = `${baseName}_frames_interval_${intervalMs}ms.zip`;
      const zipPath = path.join(OUTPUT_DIR, zipName);

      console.log(`[SERVICE] [STEP 2/3] Iniciando compressão ZIP: ${zipPath}`);
      const zipStartTime = Date.now();

      await zipDirectory(tmpDir, zipPath);

      console.log(`[SERVICE] [STEP 2/3] ZIP concluído em ${Date.now() - zipStartTime}ms`);

      const durationMs = Date.now() - startedAt;
      console.log(`[SERVICE] [STEP 3/3] Processo completo em ${durationMs}ms`);

      await this.queueService.publishVideoCompleted({
        jobId: baseName,
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
        zipPath,
        durationMs,
      };
    } catch (error) {
      await this.queueService.publishVideoCompleted({
        jobId: path.parse(file).name,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      removeDir(tmpDir);
      removeFile(inputPath);
      console.log(`[SERVICE] [CLEANUP] Limpeza concluída`);
    }
  }
}
