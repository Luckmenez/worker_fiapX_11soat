"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const process_video_service_1 = require("../../../features/process-video/process-video.service");
const fileSystemUtils = __importStar(require("../../../shared/utils/file-system.utils"));
vitest_1.vi.mock('../../../shared/utils/file-system.utils', async () => {
    const actual = await vitest_1.vi.importActual('../../../shared/utils/file-system.utils');
    return {
        ...actual,
        createTempDir: vitest_1.vi.fn(),
        removeDir: vitest_1.vi.fn(),
        removeFile: vitest_1.vi.fn(),
        zipDirectory: vitest_1.vi.fn(),
        ensureDir: vitest_1.vi.fn(),
    };
});
(0, vitest_1.describe)('ProcessVideoService', () => {
    let service;
    let mockFfmpegService;
    let mockQueueService;
    let mockS3Gateway;
    let mockEmailService;
    let testInputDir;
    let testOutputDir;
    let testTempDir;
    (0, vitest_1.beforeEach)(() => {
        testInputDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'test-input-'));
        testOutputDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'test-output-'));
        testTempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'test-temp-'));
        mockFfmpegService = {
            extractFrames: vitest_1.vi.fn().mockResolvedValue({
                frames: ['img_00001.jpg', 'img_00002.jpg', 'img_00003.jpg'],
                outputDir: testTempDir,
            }),
        };
        mockQueueService = {
            publishVideoCompleted: vitest_1.vi.fn().mockResolvedValue(undefined),
            close: vitest_1.vi.fn().mockResolvedValue(undefined),
        };
        mockS3Gateway = {
            downloadFromUrl: vitest_1.vi.fn().mockResolvedValue(undefined),
            uploadFile: vitest_1.vi.fn().mockResolvedValue('s3-key'),
        };
        mockEmailService = {
            sendEmail: vitest_1.vi.fn().mockResolvedValue(undefined),
            sendProcessingFailed: vitest_1.vi.fn().mockResolvedValue(undefined),
            sendProcessingCompleted: vitest_1.vi.fn().mockResolvedValue(undefined),
        };
        vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        vitest_1.vi.spyOn(console, 'error').mockImplementation(() => { });
        fileSystemUtils.createTempDir.mockReturnValue(testTempDir);
        fileSystemUtils.removeDir.mockImplementation(() => { });
        fileSystemUtils.removeFile.mockImplementation(() => { });
        fileSystemUtils.zipDirectory.mockResolvedValue(undefined);
        fileSystemUtils.ensureDir.mockImplementation(() => { });
        service = new process_video_service_1.ProcessVideoService(mockFfmpegService, mockQueueService, mockS3Gateway, mockEmailService);
    });
    (0, vitest_1.afterEach)(() => {
        [testInputDir, testOutputDir, testTempDir].forEach((dir) => {
            if (fs_1.default.existsSync(dir)) {
                fs_1.default.rmSync(dir, { recursive: true, force: true });
            }
        });
        vitest_1.vi.clearAllMocks();
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.describe)('constructor', () => {
        (0, vitest_1.it)('should ensure input and output directories exist', () => {
            (0, vitest_1.expect)(fileSystemUtils.ensureDir).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('processVideo', () => {
        (0, vitest_1.it)('should process video with default options', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            fs_1.default.writeFileSync(videoPath, 'fake video content');
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            const result = await service.processVideo(options);
            (0, vitest_1.expect)(result.ok).toBe(true);
            (0, vitest_1.expect)(result.input).toBe(videoFile);
            (0, vitest_1.expect)(result.intervalMs).toBe(1000);
            (0, vitest_1.expect)(result.format).toBe('jpg');
            (0, vitest_1.expect)(result.frames).toBe(3);
            (0, vitest_1.expect)(result.zipFile).toBe('test-job-123_frames_interval_1000ms.zip');
            (0, vitest_1.expect)(result.durationMs).toBeGreaterThanOrEqual(0);
        });
        (0, vitest_1.it)('should process video with custom intervalMs', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            fs_1.default.writeFileSync(videoPath, 'fake video content');
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                intervalMs: 2000,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            const result = await service.processVideo(options);
            (0, vitest_1.expect)(result.intervalMs).toBe(2000);
            (0, vitest_1.expect)(result.zipFile).toBe('test-job-123_frames_interval_2000ms.zip');
            (0, vitest_1.expect)(mockFfmpegService.extractFrames).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                intervalMs: 2000,
            }));
        });
        (0, vitest_1.it)('should process video with png format', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            fs_1.default.writeFileSync(videoPath, 'fake video content');
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                format: 'png',
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            const result = await service.processVideo(options);
            (0, vitest_1.expect)(result.format).toBe('png');
            (0, vitest_1.expect)(mockFfmpegService.extractFrames).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                format: 'png',
            }));
        });
        (0, vitest_1.it)('should throw error when S3 download fails', async () => {
            const videoFile = 'https://s3.amazonaws.com/bucket/non-existent.mp4';
            mockS3Gateway.downloadFromUrl.mockRejectedValueOnce(new Error('S3 download failed: File not found'));
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await (0, vitest_1.expect)(service.processVideo(options)).rejects.toThrow('S3 download failed: File not found');
        });
        (0, vitest_1.it)('should call ffmpegService.extractFrames with correct options', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                intervalMs: 500,
                format: 'jpg',
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await service.processVideo(options);
            (0, vitest_1.expect)(mockFfmpegService.extractFrames).toHaveBeenCalledWith({
                inputPath: videoPath,
                outputDir: testTempDir,
                intervalMs: 500,
                format: 'jpg',
            });
        });
        (0, vitest_1.it)('should create zip file from extracted frames', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await service.processVideo(options);
            (0, vitest_1.expect)(fileSystemUtils.zipDirectory).toHaveBeenCalledWith(testTempDir, vitest_1.expect.stringContaining('test-job-123_frames_interval_1000ms.zip'));
        });
        (0, vitest_1.it)('should cleanup temp directory after processing', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await service.processVideo(options);
            (0, vitest_1.expect)(fileSystemUtils.removeDir).toHaveBeenCalledWith(testTempDir);
        });
        (0, vitest_1.it)('should cleanup temp directory even when ffmpeg fails', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            mockFfmpegService.extractFrames.mockRejectedValue(new Error('FFmpeg error'));
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await (0, vitest_1.expect)(service.processVideo(options)).rejects.toThrow('FFmpeg error');
            (0, vitest_1.expect)(fileSystemUtils.removeDir).toHaveBeenCalledWith(testTempDir);
        });
        (0, vitest_1.it)('should cleanup temp directory even when zip fails', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            fileSystemUtils.zipDirectory.mockRejectedValue(new Error('Zip error'));
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await (0, vitest_1.expect)(service.processVideo(options)).rejects.toThrow('Zip error');
            (0, vitest_1.expect)(fileSystemUtils.removeDir).toHaveBeenCalledWith(testTempDir);
        });
        (0, vitest_1.it)('should return correct frame count from ffmpeg result', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            mockFfmpegService.extractFrames.mockResolvedValue({
                frames: [
                    'img_00001.jpg',
                    'img_00002.jpg',
                    'img_00003.jpg',
                    'img_00004.jpg',
                    'img_00005.jpg',
                ],
                outputDir: testTempDir,
            });
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            const result = await service.processVideo(options);
            (0, vitest_1.expect)(result.frames).toBe(5);
        });
        (0, vitest_1.it)('should generate correct zip filename from video filename', async () => {
            const videoFile = 'my-awesome-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                intervalMs: 3000,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            const result = await service.processVideo(options);
            (0, vitest_1.expect)(result.zipFile).toBe('test-job-123_frames_interval_3000ms.zip');
        });
        (0, vitest_1.it)('should measure duration correctly', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            // Add artificial delay in mock
            mockFfmpegService.extractFrames.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({
                frames: ['img_00001.jpg'],
                outputDir: testTempDir,
            }), 50)));
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            const result = await service.processVideo(options);
            (0, vitest_1.expect)(result.durationMs).toBeGreaterThanOrEqual(50);
        });
        (0, vitest_1.it)('should remove input file after successful processing', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await service.processVideo(options);
            (0, vitest_1.expect)(fileSystemUtils.removeFile).toHaveBeenCalledWith(videoPath);
        });
        (0, vitest_1.it)('should remove input file even when ffmpeg fails', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            mockFfmpegService.extractFrames.mockRejectedValue(new Error('FFmpeg error'));
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await (0, vitest_1.expect)(service.processVideo(options)).rejects.toThrow('FFmpeg error');
            (0, vitest_1.expect)(fileSystemUtils.removeFile).toHaveBeenCalledWith(videoPath);
        });
        (0, vitest_1.it)('should remove input file even when zip fails', async () => {
            const videoFile = 'test-video.mp4';
            const videoPath = path_1.default.join(testInputDir, videoFile);
            vitest_1.vi.spyOn(fileSystemUtils, 'safeJoin').mockReturnValue(videoPath);
            vitest_1.vi.spyOn(fs_1.default, 'existsSync').mockReturnValue(true);
            vitest_1.vi.spyOn(fs_1.default, 'statSync').mockReturnValue({ size: 1024 * 1024 });
            fileSystemUtils.zipDirectory.mockRejectedValue(new Error('Zip error'));
            const options = {
                file: videoFile,
                jobId: 'test-job-123',
                outputS3Prefix: 'output/test',
            };
            await (0, vitest_1.expect)(service.processVideo(options)).rejects.toThrow('Zip error');
            (0, vitest_1.expect)(fileSystemUtils.removeFile).toHaveBeenCalledWith(videoPath);
        });
    });
});
//# sourceMappingURL=process-video.service.test.js.map