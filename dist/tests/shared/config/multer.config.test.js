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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock('../../../shared/utils', () => ({
    ensureDir: vitest_1.vi.fn(),
}));
(0, vitest_1.describe)('multer.config', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        vitest_1.vi.resetModules();
    });
    (0, vitest_1.describe)('storage configuration', () => {
        (0, vitest_1.it)('should configure disk storage with correct destination', async () => {
            const { uploadVideo } = await Promise.resolve().then(() => __importStar(require('../../../shared/config/multer.config')));
            (0, vitest_1.expect)(uploadVideo).toBeDefined();
            (0, vitest_1.expect)(uploadVideo.storage).toBeDefined();
        });
        (0, vitest_1.it)('should generate unique filename with timestamp and random suffix', async () => {
            const { uploadVideo } = await Promise.resolve().then(() => __importStar(require('../../../shared/config/multer.config')));
            const storage = uploadVideo.storage;
            const mockReq = {};
            const mockFile = {
                originalname: 'test-video.mp4',
            };
            const filename = await new Promise((resolve, reject) => {
                storage.getFilename(mockReq, mockFile, (err, filename) => {
                    if (err)
                        reject(err);
                    else
                        resolve(filename);
                });
            });
            // Verify filename follows pattern: name-timestamp-random.ext
            (0, vitest_1.expect)(filename).toMatch(/^test-video-\d+-\d+\.mp4$/);
        });
    });
    (0, vitest_1.describe)('fileFilter', () => {
        const allowedMimeTypes = [
            'video/mp4',
            'video/avi',
            'video/mkv',
            'video/webm',
            'video/quicktime',
        ];
        const disallowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'audio/mp3',
            'application/pdf',
            'text/plain',
            'application/javascript',
        ];
        vitest_1.it.each(allowedMimeTypes)('should accept %s mime type', async (mimeType) => {
            const { uploadVideo } = await Promise.resolve().then(() => __importStar(require('../../../shared/config/multer.config')));
            const fileFilter = uploadVideo.fileFilter;
            const mockReq = {};
            const mockFile = { mimetype: mimeType };
            const result = await new Promise((resolve) => {
                fileFilter(mockReq, mockFile, (err, accept) => {
                    if (err)
                        resolve(false);
                    else
                        resolve(accept ?? false);
                });
            });
            (0, vitest_1.expect)(result).toBe(true);
        });
        vitest_1.it.each(disallowedMimeTypes)('should reject %s mime type', async (mimeType) => {
            const { uploadVideo } = await Promise.resolve().then(() => __importStar(require('../../../shared/config/multer.config')));
            const fileFilter = uploadVideo.fileFilter;
            const mockReq = {};
            const mockFile = { mimetype: mimeType };
            await new Promise((resolve) => {
                fileFilter(mockReq, mockFile, (err, accept) => {
                    if (err) {
                        (0, vitest_1.expect)(err.message).toContain('Invalid file type');
                        (0, vitest_1.expect)(err.message).toContain(mimeType);
                    }
                    else {
                        (0, vitest_1.expect)(accept).toBe(false);
                    }
                    resolve();
                });
            });
        });
        (0, vitest_1.it)('should include mime type in error message when rejecting', async () => {
            const { uploadVideo } = await Promise.resolve().then(() => __importStar(require('../../../shared/config/multer.config')));
            const fileFilter = uploadVideo.fileFilter;
            const mockReq = {};
            const mockFile = { mimetype: 'application/json' };
            await new Promise((resolve) => {
                fileFilter(mockReq, mockFile, (err) => {
                    (0, vitest_1.expect)(err).not.toBeNull();
                    (0, vitest_1.expect)(err?.message).toContain('application/json');
                    (0, vitest_1.expect)(err?.message).toContain('Only video files are allowed');
                    resolve();
                });
            });
        });
    });
    (0, vitest_1.describe)('limits configuration', () => {
        (0, vitest_1.it)('should have file size limit of 500MB', async () => {
            const { uploadVideo } = await Promise.resolve().then(() => __importStar(require('../../../shared/config/multer.config')));
            const limits = uploadVideo.limits;
            (0, vitest_1.expect)(limits).toBeDefined();
            (0, vitest_1.expect)(limits.fileSize).toBe(500 * 1024 * 1024);
        });
    });
    (0, vitest_1.describe)('directory initialization', () => {
        (0, vitest_1.it)('should ensure input directory exists on module load', async () => {
            const { ensureDir } = await Promise.resolve().then(() => __importStar(require('../../../shared/utils')));
            vitest_1.vi.mocked(ensureDir).mockClear();
            await vitest_1.vi.resetModules();
            await Promise.resolve().then(() => __importStar(require('../../../shared/config/multer.config')));
            (0, vitest_1.expect)(ensureDir).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=multer.config.test.js.map