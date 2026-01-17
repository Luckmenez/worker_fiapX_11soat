import { ExtractFramesOptions, ExtractFramesResult } from './ffmpeg.types';

export interface IFfmpegService {
  extractFrames(options: ExtractFramesOptions): Promise<ExtractFramesResult>;
}
