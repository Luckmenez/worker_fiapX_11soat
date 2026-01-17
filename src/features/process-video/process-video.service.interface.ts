import { ProcessVideoOptions, ProcessVideoResult } from '../../@types/process-video.types';

export interface IProcessVideoService {
  processVideo(options: ProcessVideoOptions): Promise<ProcessVideoResult>;
}
