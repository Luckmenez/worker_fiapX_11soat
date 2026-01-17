export interface ExtractFramesOptions {
  inputPath: string;
  outputDir: string;
  intervalMs: number;
  format: 'jpg' | 'png';
}

export interface ExtractFramesResult {
  frames: string[];
  outputDir: string;
}
