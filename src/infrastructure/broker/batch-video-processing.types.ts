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
  input_url: string;
  output_url: string;
}

export interface BatchVideoProcessingMessageDTO {
  person: PersonDTO;
  videos: VideoJobDTO[];
}

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
