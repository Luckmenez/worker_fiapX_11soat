import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response } from 'express';
import { ProcessVideoController } from '../../../features/process-video/process-video.controller';
import { IProcessVideoService } from '../../../features/process-video/process-video.service.interface';
import { ProcessVideoResult } from '../../../@types/process-video.types';

describe('ProcessVideoController', () => {
  let controller: ProcessVideoController;
  let mockService: IProcessVideoService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: Mock;
  let statusMock: Mock;

  beforeEach(() => {
    mockService = {
      processVideo: vi.fn(),
    };

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnThis();

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    mockRequest = {
      file: undefined,
      body: {},
    };

    controller = new ProcessVideoController(mockService);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('process', () => {
    it('should return 400 when no file is provided', async () => {
      mockRequest.file = undefined;

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'No video file provided' });
    });

    it('should return 400 when interval_ms is below minimum', async () => {
      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { interval_ms: '50' }; // Below 100ms minimum

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'interval_ms must be between 100 and 60000',
      });
    });

    it('should return 400 when interval_ms is above maximum', async () => {
      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { interval_ms: '70000' }; // Above 60000ms maximum

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'interval_ms must be between 100 and 60000',
      });
    });

    it('should process video with default options when no body params provided', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'test.mp4',
        intervalMs: 1000,
        format: 'jpg',
        frames: 10,
        zipFile: 'test_frames_interval_1000ms.zip',
        zipPath: '/output/test_frames_interval_1000ms.zip',
        durationMs: 500,
      };

      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = {};

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith({
        file: 'test.mp4',
        intervalMs: 1000,
        format: 'jpg',
      });
      expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    it('should process video with custom interval_ms', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'test.mp4',
        intervalMs: 2000,
        format: 'jpg',
        frames: 5,
        zipFile: 'test_frames_interval_2000ms.zip',
        zipPath: '/output/test_frames_interval_2000ms.zip',
        durationMs: 300,
      };

      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { interval_ms: '2000' };

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith({
        file: 'test.mp4',
        intervalMs: 2000,
        format: 'jpg',
      });
    });

    it('should process video with png format', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'test.mp4',
        intervalMs: 1000,
        format: 'png',
        frames: 10,
        zipFile: 'test_frames_interval_1000ms.zip',
        zipPath: '/output/test_frames_interval_1000ms.zip',
        durationMs: 500,
      };

      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { format: 'PNG' }; // Uppercase to test normalization

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith({
        file: 'test.mp4',
        intervalMs: 1000,
        format: 'png',
      });
    });

    it('should process video with both custom interval_ms and format', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'test.mp4',
        intervalMs: 500,
        format: 'png',
        frames: 20,
        zipFile: 'test_frames_interval_500ms.zip',
        zipPath: '/output/test_frames_interval_500ms.zip',
        durationMs: 700,
      };

      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { interval_ms: '500', format: 'png' };

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith({
        file: 'test.mp4',
        intervalMs: 500,
        format: 'png',
      });
      expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    it('should return 500 when service throws an error', async () => {
      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = {};

      (mockService.processVideo as Mock).mockRejectedValue(new Error('Processing failed'));

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Processing failed' });
    });

    it('should handle unknown errors gracefully', async () => {
      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = {};

      (mockService.processVideo as Mock).mockRejectedValue('Unknown error type');

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unknown error' });
    });

    it('should accept interval_ms at minimum boundary (100)', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'test.mp4',
        intervalMs: 100,
        format: 'jpg',
        frames: 100,
        zipFile: 'test_frames_interval_100ms.zip',
        zipPath: '/output/test_frames_interval_100ms.zip',
        durationMs: 1000,
      };

      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { interval_ms: '100' };

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith(
        expect.objectContaining({ intervalMs: 100 })
      );
    });

    it('should accept interval_ms at maximum boundary (60000)', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'test.mp4',
        intervalMs: 60000,
        format: 'jpg',
        frames: 1,
        zipFile: 'test_frames_interval_60000ms.zip',
        zipPath: '/output/test_frames_interval_60000ms.zip',
        durationMs: 100,
      };

      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { interval_ms: '60000' };

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith(
        expect.objectContaining({ intervalMs: 60000 })
      );
    });

    it('should use filename from uploaded file', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'unique-filename-123.mp4',
        intervalMs: 1000,
        format: 'jpg',
        frames: 10,
        zipFile: 'unique-filename-123_frames_interval_1000ms.zip',
        zipPath: '/output/unique-filename-123_frames_interval_1000ms.zip',
        durationMs: 500,
      };

      mockRequest.file = {
        filename: 'unique-filename-123.mp4',
        size: 2048,
      } as Express.Multer.File;
      mockRequest.body = {};

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith(
        expect.objectContaining({ file: 'unique-filename-123.mp4' })
      );
    });

    it('should convert format to lowercase', async () => {
      const mockResult: ProcessVideoResult = {
        ok: true,
        input: 'test.mp4',
        intervalMs: 1000,
        format: 'jpg',
        frames: 10,
        zipFile: 'test_frames_interval_1000ms.zip',
        zipPath: '/output/test_frames_interval_1000ms.zip',
        durationMs: 500,
      };

      mockRequest.file = {
        filename: 'test.mp4',
        size: 1024,
      } as Express.Multer.File;
      mockRequest.body = { format: 'JPG' };

      (mockService.processVideo as Mock).mockResolvedValue(mockResult);

      await controller.process(mockRequest as Request, mockResponse as Response);

      expect(mockService.processVideo).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'jpg' })
      );
    });
  });
});
