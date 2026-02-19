"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const process_video_controller_1 = require("../../../features/process-video/process-video.controller");
(0, vitest_1.describe)('ProcessVideoController', () => {
    let controller;
    let mockService;
    let mockRequest;
    let mockResponse;
    let jsonMock;
    let statusMock;
    (0, vitest_1.beforeEach)(() => {
        mockService = {
            processVideo: vitest_1.vi.fn(),
            processVideoBatch: vitest_1.vi.fn(),
        };
        jsonMock = vitest_1.vi.fn();
        statusMock = vitest_1.vi.fn().mockReturnThis();
        mockResponse = {
            json: jsonMock,
            status: statusMock,
        };
        mockRequest = {
            file: undefined,
            body: {},
        };
        controller = new process_video_controller_1.ProcessVideoController(mockService);
        vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        vitest_1.vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    (0, vitest_1.describe)('process', () => {
        (0, vitest_1.it)('should return 400 when no file is provided', async () => {
            mockRequest.file = undefined;
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(400);
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({ error: 'No video file provided' });
        });
        (0, vitest_1.it)('should return 400 when interval_ms is below minimum', async () => {
            mockRequest.file = {
                filename: 'test.mp4',
                size: 1024,
            };
            mockRequest.body = { interval_ms: '50' }; // Below 100ms minimum
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(400);
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({
                error: 'interval_ms must be between 100 and 60000',
            });
        });
        (0, vitest_1.it)('should return 400 when interval_ms is above maximum', async () => {
            mockRequest.file = {
                filename: 'test.mp4',
                size: 1024,
            };
            mockRequest.body = { interval_ms: '70000' }; // Above 60000ms maximum
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(400);
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({
                error: 'interval_ms must be between 100 and 60000',
            });
        });
        (0, vitest_1.it)('should process video with default options when no body params provided', async () => {
            const mockResult = {
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
            };
            mockRequest.body = {};
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                file: 'test.mp4',
                intervalMs: 1000,
                format: 'jpg',
            }));
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith(mockResult);
        });
        (0, vitest_1.it)('should process video with custom interval_ms', async () => {
            const mockResult = {
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
            };
            mockRequest.body = { interval_ms: '2000' };
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                file: 'test.mp4',
                intervalMs: 2000,
                format: 'jpg',
            }));
        });
        (0, vitest_1.it)('should process video with png format', async () => {
            const mockResult = {
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
            };
            mockRequest.body = { format: 'PNG' }; // Uppercase to test normalization
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                file: 'test.mp4',
                intervalMs: 1000,
                format: 'png',
            }));
        });
        (0, vitest_1.it)('should process video with both custom interval_ms and format', async () => {
            const mockResult = {
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
            };
            mockRequest.body = { interval_ms: '500', format: 'png' };
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                file: 'test.mp4',
                intervalMs: 500,
                format: 'png',
            }));
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith(mockResult);
        });
        (0, vitest_1.it)('should return 500 when service throws an error', async () => {
            mockRequest.file = {
                filename: 'test.mp4',
                size: 1024,
            };
            mockRequest.body = {};
            mockService.processVideo.mockRejectedValue(new Error('Processing failed'));
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(500);
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({ error: 'Processing failed' });
        });
        (0, vitest_1.it)('should handle unknown errors gracefully', async () => {
            mockRequest.file = {
                filename: 'test.mp4',
                size: 1024,
            };
            mockRequest.body = {};
            mockService.processVideo.mockRejectedValue('Unknown error type');
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(500);
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({ error: 'Unknown error' });
        });
        (0, vitest_1.it)('should accept interval_ms at minimum boundary (100)', async () => {
            const mockResult = {
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
            };
            mockRequest.body = { interval_ms: '100' };
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ intervalMs: 100 }));
        });
        (0, vitest_1.it)('should accept interval_ms at maximum boundary (60000)', async () => {
            const mockResult = {
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
            };
            mockRequest.body = { interval_ms: '60000' };
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ intervalMs: 60000 }));
        });
        (0, vitest_1.it)('should use filename from uploaded file', async () => {
            const mockResult = {
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
            };
            mockRequest.body = {};
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ file: 'unique-filename-123.mp4' }));
        });
        (0, vitest_1.it)('should convert format to lowercase', async () => {
            const mockResult = {
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
            };
            mockRequest.body = { format: 'JPG' };
            mockService.processVideo.mockResolvedValue(mockResult);
            await controller.process(mockRequest, mockResponse);
            (0, vitest_1.expect)(mockService.processVideo).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ format: 'jpg' }));
        });
    });
});
//# sourceMappingURL=process-video.controller.test.js.map