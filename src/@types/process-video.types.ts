export enum VideoStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Video {
  id: string;
  filename: string;
  originalPath: string;
  outputPath?: string;
  status: VideoStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVideoDTO {
  filename: string;
  originalPath: string;
}

export interface UpdateVideoDTO {
  status?: VideoStatus;
  outputPath?: string;
}

export interface ProcessVideoOptions {
  file: string;
  intervalMs?: number;
  format?: 'jpg' | 'png';
}

export interface ProcessVideoResult {
  ok: boolean;
  input: string;
  intervalMs: number;
  format: string;
  frames: number;
  zipFile: string;
  zipPath: string;
  durationMs: number;
}
