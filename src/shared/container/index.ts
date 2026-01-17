import { container } from 'tsyringe';

import { IFfmpegService } from '../../features/ffmpeg/ffmpeg.service.interface';
import { FfmpegService } from '../../features/ffmpeg/ffmpeg.service';
import { IProcessVideoService } from '../../features/process-video/process-video.service.interface';
import { ProcessVideoService } from '../../features/process-video/process-video.service';

container.registerSingleton<IFfmpegService>('FfmpegService', FfmpegService);
container.registerSingleton<IProcessVideoService>('ProcessVideoService', ProcessVideoService);

export { container };
