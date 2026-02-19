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
  jobId: string;
  outputS3Prefix: string;
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

export interface ProcessVideoBatchOptions {
  videoId: string;
  processingId: string;
  inputS3Uri: string; // s3://bucket/path/to/input/
  outputS3Uri: string; // s3://bucket/path/to/output/
  intervalMs: number;
  format: 'jpg' | 'png';
  clientId: string;
  email: string;
  personName?: string; // Optional: Nome da pessoa para personalizar e-mails
}

export interface ProcessVideoBatchResult {
  videoId: string;
  processingId: string;
  ok: boolean;
  videosProcessed: number;
  totalFrames: number;
  zipFiles: string[];
  durationMs: number;
}
