import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { IProcessVideoService } from './process-video.service.interface';

interface ProcessVideoBody {
  interval_ms?: string;
  format?: string;
}

const MIN_INTERVAL_MS = 100;
const MAX_INTERVAL_MS = 60000;
const DEFAULT_INTERVAL_MS = 1000;

@injectable()
export class ProcessVideoController {
  constructor(
    @inject('ProcessVideoService')
    private readonly service: IProcessVideoService
  ) {}

  async process(req: Request<object, object, ProcessVideoBody>, res: Response): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] [CONTROLLER] Requisição recebida`);
    console.log(`[${requestId}] [CONTROLLER] File: ${req.file?.filename || 'N/A'}, Size: ${req.file?.size || 0} bytes`);

    try {
      if (!req.file) {
        console.log(`[${requestId}] [CONTROLLER] Erro: Nenhum arquivo enviado`);
        res.status(400).json({ error: 'No video file provided' });
        return;
      }

      const intervalMs = Number(req.body.interval_ms || DEFAULT_INTERVAL_MS);
      const format = String(req.body.format || 'jpg').toLowerCase() as 'jpg' | 'png';

      if (intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS) {
        console.log(`[${requestId}] [CONTROLLER] Erro: interval_ms fora do range permitido`);
        res.status(400).json({
          error: `interval_ms must be between ${MIN_INTERVAL_MS} and ${MAX_INTERVAL_MS}`,
        });
        return;
      }

      console.log(`[${requestId}] [CONTROLLER] Parâmetros: intervalMs=${intervalMs}ms, format=${format}`);
      console.log(`[${requestId}] [CONTROLLER] Iniciando processamento...`);

      const startTime = Date.now();
      const result = await this.service.processVideo({
        file: req.file.filename,
        intervalMs,
        format,
      });

      console.log(`[${requestId}] [CONTROLLER] Processamento concluído em ${Date.now() - startTime}ms`);
      console.log(`[${requestId}] [CONTROLLER] Resultado: ${result.frames} frames extraídos`);

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${requestId}] [CONTROLLER] ERRO: ${message}`);
      console.error(`[${requestId}] [CONTROLLER] Stack:`, error instanceof Error ? error.stack : 'N/A');
      res.status(500).json({ error: message });
    }
  }
}
