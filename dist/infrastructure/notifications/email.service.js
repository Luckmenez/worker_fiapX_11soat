"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const client_ses_1 = require("@aws-sdk/client-ses");
const tsyringe_1 = require("tsyringe");
const email_templates_1 = require("./email-templates");
const monitoring_1 = require("../monitoring");
let EmailService = class EmailService {
    client;
    fromEmail;
    enabled;
    constructor() {
        const region = process.env.AWS_REGION || 'us-east-1';
        this.fromEmail = process.env.EMAIL_FROM || 'noreply@fiapx.com';
        this.enabled = process.env.EMAIL_ENABLED === 'true';
        this.client = new client_ses_1.SESClient({
            region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        monitoring_1.logger.info({
            type: 'email.init',
            enabled: this.enabled,
            from: this.fromEmail,
            region,
        }, `Email service initialized - Enabled: ${this.enabled}`);
    }
    async sendEmail(options) {
        if (!this.enabled) {
            monitoring_1.logger.warn({
                type: 'email.disabled',
                to: options.to,
                subject: options.subject,
            }, 'Email sending is disabled. Skipping email.');
            return;
        }
        try {
            monitoring_1.logger.info({
                type: 'email.sending',
                to: options.to,
                subject: options.subject,
            }, `Sending email to: ${options.to}`);
            const command = new client_ses_1.SendEmailCommand({
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
            monitoring_1.logger.info({
                type: 'email.sent',
                to: options.to,
                subject: options.subject,
                messageId: response.MessageId,
            }, `Email sent successfully to: ${options.to}`);
        }
        catch (error) {
            (0, monitoring_1.logError)(error, 'EmailService.sendEmail', {
                to: options.to,
                subject: options.subject,
            });
            // Re-throw to allow caller to handle
            throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async sendProcessingFailed(to, data) {
        monitoring_1.logger.info({
            type: 'email.processing-failed',
            to,
            videoId: data.videoId,
            attemptCount: data.attemptCount,
        }, `Sending processing failed email for video: ${data.videoId}`);
        const { html, text } = (0, email_templates_1.buildProcessingFailedEmail)(data);
        await this.sendEmail({
            to,
            subject: `❌ Falha no Processamento - Vídeo ${data.fileName}`,
            htmlBody: html,
            textBody: text,
        });
    }
    async sendProcessingCompleted(to, data) {
        monitoring_1.logger.info({
            type: 'email.processing-completed',
            to,
            videoId: data.videoId,
            frames: data.framesExtracted,
        }, `Sending processing completed email for video: ${data.videoId}`);
        const { html, text } = (0, email_templates_1.buildProcessingCompletedEmail)(data);
        await this.sendEmail({
            to,
            subject: `✅ Vídeo Processado com Sucesso - ${data.fileName}`,
            htmlBody: html,
            textBody: text,
        });
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], EmailService);
//# sourceMappingURL=email.service.js.map