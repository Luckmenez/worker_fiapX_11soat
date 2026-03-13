import { container } from 'tsyringe';

import { IFfmpegService } from '../../features/ffmpeg/ffmpeg.service.interface';
import { FfmpegService } from '../../features/ffmpeg/ffmpeg.service';
import { IProcessVideoService } from '../../features/process-video/process-video.service.interface';
import { ProcessVideoService } from '../../features/process-video/process-video.service';
import { RabbitMQQueueService } from '../../infrastructure/broker/rabbitmq-queue.service';
import { IS3Gateway } from '../../infrastructure/gateways/s3.gateway.interface';
import { S3Gateway } from '../../infrastructure/gateways/s3.gateway';
import { IEmailService } from '../../infrastructure/notifications';
import { EmailService } from '../../infrastructure/notifications';
import { HealthCheckUseCase } from '../../application/use-cases/health-check.use-case';

container.registerSingleton<IFfmpegService>('FfmpegService', FfmpegService);
container.registerSingleton<IProcessVideoService>('ProcessVideoService', ProcessVideoService);
container.registerSingleton<RabbitMQQueueService>('RabbitMQQueueService', RabbitMQQueueService);
container.registerSingleton<IS3Gateway>('S3Gateway', S3Gateway);
container.registerSingleton<IEmailService>('EmailService', EmailService);
container.registerSingleton<HealthCheckUseCase>(HealthCheckUseCase);

export { container };
