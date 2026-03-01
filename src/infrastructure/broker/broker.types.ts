export interface VideoProcessingMessageDTO {
  jobId: string;
  clientId: string;
  inputUrlStorage: string;
  outputUrlStorage: string;
  framesPerSecond: number;
  format: 'jpg' | 'png';
}

export interface VideoCompletedMessageDTO {
  jobId: string;
  processingId?: string;
  status: 'COMPLETED' | 'FAILED';
  error?: string;
  framesExtracted?: number;
}
