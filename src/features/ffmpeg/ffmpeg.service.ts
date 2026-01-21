import { injectable } from 'tsyringe';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { IFfmpegService } from './ffmpeg.service.interface';
import { ExtractFramesOptions, ExtractFramesResult } from './ffmpeg.types';

@injectable()
export class FfmpegService implements IFfmpegService {
  async extractFrames(options: ExtractFramesOptions): Promise<ExtractFramesResult> {
    const { inputPath, outputDir, intervalMs, format } = options;

    // Converte intervalo em milissegundos para FPS
    // Ex: 3000ms = 1 frame a cada 3 segundos = 1/3 FPS
    const intervalSeconds = intervalMs / 1000;
    const fps = 1 / intervalSeconds;

    console.log(`[FFMPEG] Iniciando extractFrames`);
    console.log(`[FFMPEG] Input: ${inputPath}`);
    console.log(`[FFMPEG] Output dir: ${outputDir}`);
    console.log(
      `[FFMPEG] Intervalo: ${intervalMs}ms (${intervalSeconds}s) = ${fps.toFixed(4)} FPS`
    );
    console.log(`[FFMPEG] Format: ${format}`);

    const framesPattern = path.join(outputDir, `img_%05d.${format}`);

    const ffmpegArgs = [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputPath,
      '-vf',
      `fps=1/${intervalSeconds}`,
      framesPattern,
    ];

    console.log(`[FFMPEG] Comando: ffmpeg ${ffmpegArgs.join(' ')}`);
    console.log(`[FFMPEG] Executando FFmpeg...`);

    const startTime = Date.now();
    await this.runFfmpeg(ffmpegArgs);
    console.log(`[FFMPEG] FFmpeg finalizou em ${Date.now() - startTime}ms`);

    console.log(`[FFMPEG] Listando frames gerados...`);
    const frames = this.listFrames(outputDir, format);
    console.log(`[FFMPEG] Total de frames encontrados: ${frames.length}`);

    return {
      frames,
      outputDir,
    };
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ffmpegPath) {
        console.error(`[FFMPEG] ERRO: ffmpeg binary não encontrado`);
        return reject(new Error('ffmpeg binary not found'));
      }

      console.log(`[FFMPEG] FFmpeg path: ${ffmpegPath}`);
      console.log(`[FFMPEG] Spawning process...`);

      const ffmpegProcess: ChildProcess = spawn(ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      console.log(`[FFMPEG] Processo criado com PID: ${ffmpegProcess.pid}`);

      let stderr = '';
      let lastProgressLog = Date.now();

      // Log de progresso a cada 10 segundos
      const progressInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - lastProgressLog) / 1000);
        console.log(
          `[FFMPEG] Processo ainda em execução... (${elapsed}s desde último log, PID: ${ffmpegProcess.pid})`
        );
        lastProgressLog = Date.now();
      }, 10000);

      ffmpegProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.log(`[FFMPEG] stderr: ${chunk.trim()}`);
      });

      ffmpegProcess.stdout?.on('data', (data) => {
        console.log(`[FFMPEG] stdout: ${data.toString().trim()}`);
      });

      ffmpegProcess.on('error', (error) => {
        clearInterval(progressInterval);
        console.error(`[FFMPEG] Erro no processo: ${error.message}`);
        reject(error);
      });

      ffmpegProcess.on('close', (code) => {
        clearInterval(progressInterval);
        console.log(`[FFMPEG] Processo encerrado com código: ${code}`);

        if (code === 0) {
          console.log(`[FFMPEG] Sucesso!`);
          return resolve();
        }

        console.error(`[FFMPEG] Falha! Código: ${code}`);
        console.error(`[FFMPEG] Stderr completo: ${stderr}`);
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
      });
    });
  }

  private listFrames(dirPath: string, format: string): string[] {
    console.log(`[FFMPEG] Lendo diretório: ${dirPath}`);
    const allFiles = fs.readdirSync(dirPath);
    console.log(`[FFMPEG] Arquivos no diretório: ${allFiles.length}`);

    const frames = allFiles
      .filter((file) => file.startsWith('img') && file.endsWith(`.${format}`))
      .sort();

    console.log(`[FFMPEG] Frames filtrados: ${frames.length}`);
    return frames;
  }
}
