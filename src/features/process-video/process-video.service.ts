import path from 'path';
import fs from 'fs';
import { inject, injectable } from 'tsyringe';
import { IProcessVideoService } from './process-video.service.interface';
import { IFfmpegService } from '../ffmpeg/ffmpeg.service.interface';
import { ProcessVideoOptions, ProcessVideoResult } from '../../@types/process-video.types';
import { safeJoin, createTempDir, removeDir, zipDirectory, ensureDir } from '../../shared/utils';

const INPUT_DIR = path.resolve('./input');
const OUTPUT_DIR = path.resolve('./output');

@injectable()
export class ProcessVideoService implements IProcessVideoService {
  constructor(
    @inject('FfmpegService')
    private readonly ffmpegService: IFfmpegService
  ) {
    ensureDir(INPUT_DIR);
    ensureDir(OUTPUT_DIR);
  }

  async processVideo(options: ProcessVideoOptions): Promise<ProcessVideoResult> {
    const { file, intervalMs = 1000, format = 'jpg' } = options;

    console.log(`[SERVICE] Iniciando processVideo para: ${file}`);
    console.log(`[SERVICE] Configuração: intervalMs=${intervalMs}ms, format=${format}`);

    const inputPath = safeJoin(INPUT_DIR, file);
    console.log(`[SERVICE] Caminho do input: ${inputPath}`);

    if (!fs.existsSync(inputPath)) {
      console.error(`[SERVICE] ERRO: Arquivo não encontrado: ${inputPath}`);
      throw new Error(`Arquivo de vídeo não encontrado: ${inputPath}`);
    }

    const fileStats = fs.statSync(inputPath);
    console.log(`[SERVICE] Tamanho do arquivo: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

    const tmpDir = createTempDir('frames-');
    console.log(`[SERVICE] Diretório temporário criado: ${tmpDir}`);

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
    } finally {
      console.log(`[SERVICE] [CLEANUP] Removendo diretório temporário: ${tmpDir}`);
      removeDir(tmpDir);
      console.log(`[SERVICE] [CLEANUP] Limpeza concluída`);
    }
  }
}
