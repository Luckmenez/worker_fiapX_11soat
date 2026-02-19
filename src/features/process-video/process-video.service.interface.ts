import {
  ProcessVideoOptions,
  ProcessVideoResult,
  ProcessVideoBatchOptions,
  ProcessVideoBatchResult,
} from '../../@types/process-video.types';

export interface IProcessVideoService {
  processVideo(options: ProcessVideoOptions): Promise<ProcessVideoResult>;
  processVideoBatch(options: ProcessVideoBatchOptions): Promise<ProcessVideoBatchResult>;
}
