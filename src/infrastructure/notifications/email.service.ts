import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { injectable } from 'tsyringe';
import {
  IEmailService,
  SendEmailOptions,
  ProcessingFailedEmailData,
  ProcessingCompletedEmailData,
} from './email.service.interface';
import { buildProcessingFailedEmail, buildProcessingCompletedEmail } from './email-templates';
import { logger, logError } from '../monitoring';

@injectable()
export class EmailService implements IEmailService {
  private client: SESClient;
  private fromEmail: string;
  private enabled: boolean;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@fiapx.com';
    this.enabled = process.env.EMAIL_ENABLED === 'true';

    this.client = new SESClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    logger.info(
      {
        type: 'email.init',
        enabled: this.enabled,
        from: this.fromEmail,
        region,
      },
      `Email service initialized - Enabled: ${this.enabled}`
    );
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.enabled) {
      logger.warn(
        {
          type: 'email.disabled',
          to: options.to,
          subject: options.subject,
        },
        'Email sending is disabled. Skipping email.'
      );
      return;
    }

    try {
      logger.info(
        {
          type: 'email.sending',
          to: options.to,
          subject: options.subject,
        },
        `Sending email to: ${options.to}`
      );

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: options.htmlBody,
              Charset: 'UTF-8',
            },
            Text: options.textBody
              ? {
                  Data: options.textBody,
                  Charset: 'UTF-8',
                }
              : undefined,
          },
        },
      });

      const response = await this.client.send(command);

      logger.info(
        {
          type: 'email.sent',
          to: options.to,
          subject: options.subject,
          messageId: response.MessageId,
        },
        `Email sent successfully to: ${options.to}`
      );
    } catch (error) {
      logError(error, 'EmailService.sendEmail', {
        to: options.to,
        subject: options.subject,
      });

      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async sendProcessingFailed(to: string, data: ProcessingFailedEmailData): Promise<void> {
    logger.info(
      {
        type: 'email.processing-failed',
        to,
        videoId: data.videoId,
        attemptCount: data.attemptCount,
      },
      `Sending processing failed email for video: ${data.videoId}`
    );

    const { html, text } = buildProcessingFailedEmail(data);

    await this.sendEmail({
      to,
      subject: `❌ Falha no Processamento - Vídeo ${data.fileName}`,
      htmlBody: html,
      textBody: text,
    });
  }

  async sendProcessingCompleted(to: string, data: ProcessingCompletedEmailData): Promise<void> {
    logger.info(
      {
        type: 'email.processing-completed',
        to,
        videoId: data.videoId,
        frames: data.framesExtracted,
      },
      `Sending processing completed email for video: ${data.videoId}`
    );

    const { html, text } = buildProcessingCompletedEmail(data);

    await this.sendEmail({
      to,
      subject: `✅ Vídeo Processado com Sucesso - ${data.fileName}`,
      htmlBody: html,
      textBody: text,
    });
  }
}
