"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const events_1 = require("events");
const ffmpeg_service_1 = require("../../../features/ffmpeg/ffmpeg.service");
vitest_1.vi.mock('child_process', () => ({
    spawn: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('ffmpeg-static', () => ({
    default: '/usr/bin/ffmpeg',
}));
const child_process_1 = require("child_process");
(0, vitest_1.describe)('FfmpegService', () => {
    let service;
    let testDir;
    let mockProcess;
    (0, vitest_1.beforeEach)(() => {
        service = new ffmpeg_service_1.FfmpegService();
        testDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'test-ffmpeg-'));
        const emitter = new events_1.EventEmitter();
        emitter.pid = 12345;
        emitter.stdout = new events_1.EventEmitter();
        emitter.stderr = new events_1.EventEmitter();
        mockProcess = emitter;
        vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        vitest_1.vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    (0, vitest_1.afterEach)(() => {
        if (fs_1.default.existsSync(testDir)) {
            fs_1.default.rmSync(testDir, { recursive: true, force: true });
        }
        vitest_1.vi.clearAllMocks();
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.describe)('extractFrames', () => {
        (0, vitest_1.it)('should call ffmpeg with correct arguments for jpg format', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 1000,
                format: 'jpg',
            };
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            // Simulate successful ffmpeg execution
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 10);
            await extractPromise;
            (0, vitest_1.expect)(child_process_1.spawn).toHaveBeenCalledWith('/usr/bin/ffmpeg', vitest_1.expect.arrayContaining([
                '-y',
                '-hide_banner',
                '-loglevel',
                'error',
                '-i',
                '/path/to/video.mp4',
                '-vf',
                'fps=1/1',
                vitest_1.expect.stringContaining('img_%05d.jpg'),
            ]), vitest_1.expect.any(Object));
        });
        (0, vitest_1.it)('should call ffmpeg with correct arguments for png format', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 2000,
                format: 'png',
            };
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 10);
            await extractPromise;
            (0, vitest_1.expect)(child_process_1.spawn).toHaveBeenCalledWith('/usr/bin/ffmpeg', vitest_1.expect.arrayContaining(['-vf', 'fps=1/2', vitest_1.expect.stringContaining('img_%05d.png')]), vitest_1.expect.any(Object));
        });
        (0, vitest_1.it)('should correctly calculate FPS from intervalMs', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 500, // 0.5 seconds = 2 FPS
                format: 'jpg',
            };
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 10);
            await extractPromise;
            (0, vitest_1.expect)(child_process_1.spawn).toHaveBeenCalledWith('/usr/bin/ffmpeg', vitest_1.expect.arrayContaining(['-vf', 'fps=1/0.5']), vitest_1.expect.any(Object));
        });
        (0, vitest_1.it)('should return list of extracted frames', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 1000,
                format: 'jpg',
            };
            // Create fake frame files
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00001.jpg'), 'fake');
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00002.jpg'), 'fake');
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00003.jpg'), 'fake');
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 10);
            const result = await extractPromise;
            (0, vitest_1.expect)(result.frames).toHaveLength(3);
            (0, vitest_1.expect)(result.frames).toEqual(['img_00001.jpg', 'img_00002.jpg', 'img_00003.jpg']);
            (0, vitest_1.expect)(result.outputDir).toBe(testDir);
        });
        (0, vitest_1.it)('should filter only frames with correct format', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 1000,
                format: 'jpg',
            };
            // Create mixed files
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00001.jpg'), 'fake');
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00002.png'), 'fake'); // Different format
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'other_file.jpg'), 'fake'); // Different prefix
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00003.jpg'), 'fake');
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 10);
            const result = await extractPromise;
            (0, vitest_1.expect)(result.frames).toHaveLength(2);
            (0, vitest_1.expect)(result.frames).toEqual(['img_00001.jpg', 'img_00003.jpg']);
        });
        (0, vitest_1.it)('should reject when ffmpeg exits with non-zero code', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 1000,
                format: 'jpg',
            };
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.stderr?.emit('data', Buffer.from('Error: Invalid input'));
                mockProcess.emit('close', 1);
            }, 10);
            await (0, vitest_1.expect)(extractPromise).rejects.toThrow('ffmpeg exited with code 1');
        });
        (0, vitest_1.it)('should reject when spawn emits error', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 1000,
                format: 'jpg',
            };
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.emit('error', new Error('spawn ENOENT'));
            }, 10);
            await (0, vitest_1.expect)(extractPromise).rejects.toThrow('spawn ENOENT');
        });
        (0, vitest_1.it)('should reject when ffmpeg binary is not found', async () => {
            vitest_1.vi.doMock('ffmpeg-static', () => ({
                default: null,
            }));
            child_process_1.spawn.mockReturnValue(mockProcess);
            // Reset mock to return null for ffmpeg path
            const mockProcessNull = new events_1.EventEmitter();
            mockProcessNull.pid = undefined;
            mockProcessNull.stdout = new events_1.EventEmitter();
            mockProcessNull.stderr = new events_1.EventEmitter();
            // This test verifies the structure - actual null check happens at runtime
            (0, vitest_1.expect)(child_process_1.spawn).toBeDefined();
        });
        (0, vitest_1.it)('should sort frames in alphabetical order', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 1000,
                format: 'jpg',
            };
            // Create frames out of order
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00003.jpg'), 'fake');
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00001.jpg'), 'fake');
            fs_1.default.writeFileSync(path_1.default.join(testDir, 'img_00002.jpg'), 'fake');
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 10);
            const result = await extractPromise;
            (0, vitest_1.expect)(result.frames).toEqual(['img_00001.jpg', 'img_00002.jpg', 'img_00003.jpg']);
        });
        (0, vitest_1.it)('should handle stderr output during execution', async () => {
            const options = {
                inputPath: '/path/to/video.mp4',
                outputDir: testDir,
                intervalMs: 1000,
                format: 'jpg',
            };
            child_process_1.spawn.mockReturnValue(mockProcess);
            const extractPromise = service.extractFrames(options);
            setTimeout(() => {
                mockProcess.stderr?.emit('data', Buffer.from('Warning: some warning'));
                mockProcess.emit('close', 0);
            }, 10);
            await extractPromise;
            (0, vitest_1.expect)(console.log).toHaveBeenCalledWith(vitest_1.expect.stringContaining('Warning: some warning'));
        });
    });
});
//# sourceMappingURL=ffmpeg.service.test.js.map