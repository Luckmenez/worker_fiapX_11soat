import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProcessVideoService } from '../../../features/process-video/process-video.service';
import { IFfmpegService } from '../../../features/ffmpeg/ffmpeg.service.interface';
import { ProcessVideoOptions } from '../../../@types/process-video.types';
import * as fileSystemUtils from '../../../shared/utils/file-system.utils';

vi.mock('../../../shared/utils/file-system.utils', async () => {
  const actual = await vi.importActual('../../../shared/utils/file-system.utils');
  return {
    ...actual,
    createTempDir: vi.fn(),
    removeDir: vi.fn(),
    zipDirectory: vi.fn(),
    ensureDir: vi.fn(),
  };
});

describe('ProcessVideoService', () => {
  let service: ProcessVideoService;
  let mockFfmpegService: IFfmpegService;
  let testInputDir: string;
  let testOutputDir: string;
  let testTempDir: string;

  beforeEach(() => {
    testInputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-input-'));
    testOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-output-'));
    testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-temp-'));

    mockFfmpegService = {
      extractFrames: vi.fn().mockResolvedValue({
        frames: ['img_00001.jpg', 'img_00002.jpg', 'img_00003.jpg'],
        outputDir: testTempDir,
      }),
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    (fileSystemUtils.createTempDir as Mock).mockReturnValue(testTempDir);
    (fileSystemUtils.removeDir as Mock).mockImplementation(() => {});
    (fileSystemUtils.zipDirectory as Mock).mockResolvedValue(undefined);
    (fileSystemUtils.ensureDir as Mock).mockImplementation(() => {});

    service = new ProcessVideoService(mockFfmpegService);
  });

  afterEach(() => {
    [testInputDir, testOutputDir, testTempDir].forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should ensure input and output directories exist', () => {
      expect(fileSystemUtils.ensureDir).toHaveBeenCalled();
    });
  });

  describe('processVideo', () => {
    it('should process video with default options', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);
      fs.writeFileSync(videoPath, 'fake video content');

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      const result = await service.processVideo(options);

      expect(result.ok).toBe(true);
      expect(result.input).toBe(videoFile);
      expect(result.intervalMs).toBe(1000);
      expect(result.format).toBe('jpg');
      expect(result.frames).toBe(3);
      expect(result.zipFile).toBe('test-video_frames_interval_1000ms.zip');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should process video with custom intervalMs', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);
      fs.writeFileSync(videoPath, 'fake video content');

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      const options: ProcessVideoOptions = {
        file: videoFile,
        intervalMs: 2000,
      };

      const result = await service.processVideo(options);

      expect(result.intervalMs).toBe(2000);
      expect(result.zipFile).toBe('test-video_frames_interval_2000ms.zip');
      expect(mockFfmpegService.extractFrames).toHaveBeenCalledWith(
        expect.objectContaining({
          intervalMs: 2000,
        })
      );
    });

    it('should process video with png format', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);
      fs.writeFileSync(videoPath, 'fake video content');

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      const options: ProcessVideoOptions = {
        file: videoFile,
        format: 'png',
      };

      const result = await service.processVideo(options);

      expect(result.format).toBe('png');
      expect(mockFfmpegService.extractFrames).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'png',
        })
      );
    });

    it('should throw error when video file does not exist', async () => {
      const videoFile = 'non-existent.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      await expect(service.processVideo(options)).rejects.toThrow(
        `Arquivo de vídeo não encontrado: ${videoPath}`
      );
    });

    it('should call ffmpegService.extractFrames with correct options', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      const options: ProcessVideoOptions = {
        file: videoFile,
        intervalMs: 500,
        format: 'jpg',
      };

      await service.processVideo(options);

      expect(mockFfmpegService.extractFrames).toHaveBeenCalledWith({
        inputPath: videoPath,
        outputDir: testTempDir,
        intervalMs: 500,
        format: 'jpg',
      });
    });

    it('should create zip file from extracted frames', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      await service.processVideo(options);

      expect(fileSystemUtils.zipDirectory).toHaveBeenCalledWith(
        testTempDir,
        expect.stringContaining('test-video_frames_interval_1000ms.zip')
      );
    });

    it('should cleanup temp directory after processing', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      await service.processVideo(options);

      expect(fileSystemUtils.removeDir).toHaveBeenCalledWith(testTempDir);
    });

    it('should cleanup temp directory even when ffmpeg fails', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      (mockFfmpegService.extractFrames as Mock).mockRejectedValue(
        new Error('FFmpeg error')
      );

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      await expect(service.processVideo(options)).rejects.toThrow('FFmpeg error');
      expect(fileSystemUtils.removeDir).toHaveBeenCalledWith(testTempDir);
    });

    it('should cleanup temp directory even when zip fails', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      (fileSystemUtils.zipDirectory as Mock).mockRejectedValue(
        new Error('Zip error')
      );

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      await expect(service.processVideo(options)).rejects.toThrow('Zip error');
      expect(fileSystemUtils.removeDir).toHaveBeenCalledWith(testTempDir);
    });

    it('should return correct frame count from ffmpeg result', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      (mockFfmpegService.extractFrames as Mock).mockResolvedValue({
        frames: ['img_00001.jpg', 'img_00002.jpg', 'img_00003.jpg', 'img_00004.jpg', 'img_00005.jpg'],
        outputDir: testTempDir,
      });

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      const result = await service.processVideo(options);

      expect(result.frames).toBe(5);
    });

    it('should generate correct zip filename from video filename', async () => {
      const videoFile = 'my-awesome-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      const options: ProcessVideoOptions = {
        file: videoFile,
        intervalMs: 3000,
      };

      const result = await service.processVideo(options);

      expect(result.zipFile).toBe('my-awesome-video_frames_interval_3000ms.zip');
    });

    it('should measure duration correctly', async () => {
      const videoFile = 'test-video.mp4';
      const videoPath = path.join(testInputDir, videoFile);

      vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as fs.Stats);

      // Add artificial delay in mock
      (mockFfmpegService.extractFrames as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          frames: ['img_00001.jpg'],
          outputDir: testTempDir,
        }), 50))
      );

      const options: ProcessVideoOptions = {
        file: videoFile,
      };

      const result = await service.processVideo(options);

      expect(result.durationMs).toBeGreaterThanOrEqual(50);
    });
  });
});
