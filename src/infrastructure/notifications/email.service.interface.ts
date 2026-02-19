export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface ProcessingFailedEmailData {
  personName: string;
  videoId: string;
  fileName: string;
  error: string;
  attemptCount: number;
}

export interface ProcessingCompletedEmailData {
  personName: string;
  videoId: string;
  fileName: string;
  framesExtracted: number;
  processingTime: string;
}

export interface IEmailService {
  sendEmail(options: SendEmailOptions): Promise<void>;
  sendProcessingFailed(to: string, data: ProcessingFailedEmailData): Promise<void>;
  sendProcessingCompleted(to: string, data: ProcessingCompletedEmailData): Promise<void>;
}
