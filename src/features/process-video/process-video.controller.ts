import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { IProcessVideoService } from './process-video.service.interface';
import { logger, logError } from '../../infrastructure/monitoring';

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
    logger.info({ type: 'controller.request', requestId }, 'Request received');
    logger.info(
      {
        type: 'controller.file',
        requestId,
        fileName: req.file?.filename,
        fileSize: req.file?.size,
      },
      'File uploaded'
    );

    try {
      if (!req.file) {
        logger.warn({ type: 'controller.error', requestId }, 'No file provided');
        res.status(400).json({ error: 'No video file provided' });
        return;
      }

      const intervalMs = Number(req.body.interval_ms || DEFAULT_INTERVAL_MS);
      const format = String(req.body.format || 'jpg').toLowerCase() as 'jpg' | 'png';

      if (intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS) {
        logger.warn({ type: 'controller.error', requestId }, 'interval_ms out of range');
        res.status(400).json({
          error: `interval_ms must be between ${MIN_INTERVAL_MS} and ${MAX_INTERVAL_MS}`,
        });
        return;
      }

      logger.info(
        { type: 'controller.params', requestId, intervalMs, format },
        'Processing parameters'
      );
      logger.info({ type: 'controller.processing', requestId }, 'Starting processing');

      const startTime = Date.now();

      const jobId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const outputS3Prefix = 'output/local';

      const result = await this.service.processVideo({
        file: req.file.filename,
        intervalMs,
        format,
        jobId,
        outputS3Prefix,
      });

      logger.info(
        { type: 'controller.completed', requestId, durationMs: Date.now() - startTime },
        'Processing completed'
      );
      logger.info(
        { type: 'controller.result', requestId, frames: result.frames },
        `${result.frames} frames extracted`
      );

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logError(error, 'ProcessVideoController', { requestId });

      res.status(500).json({ error: message });
    }
  }
}
