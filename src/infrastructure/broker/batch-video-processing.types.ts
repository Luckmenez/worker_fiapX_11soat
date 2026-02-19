/**
 * Batch Video Processing DTOs
 *
 * Estrutura para processamento de múltiplos vídeos em lote
 */

export interface PersonDTO {
  clientId: string;
  name: string;
  email: string;
}

export interface VideoJobDTO {
  id: string;
  id_processamento: string;
  framesPerSecond: number;
  format: 'jpg' | 'png';
  input_url: string; // s3://bucket/path/to/input/
  output_url: string; // s3://bucket/path/to/output/
}

export interface BatchVideoProcessingMessageDTO {
  person: PersonDTO;
  videos: VideoJobDTO[];
}

/**
 * Individual video processing message
 * Used internally to process each video from the batch
 */
export interface IndividualVideoProcessingDTO {
  videoId: string;
  processingId: string;
  clientId: string;
  email: string;
  userName: string;
  framesPerSecond: number;
  format: 'jpg' | 'png';
  inputS3Url: string;
  outputS3Url: string;
}
