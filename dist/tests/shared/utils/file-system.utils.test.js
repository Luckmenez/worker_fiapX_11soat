"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const file_system_utils_1 = require("../../../shared/utils/file-system.utils");
(0, vitest_1.describe)('file-system.utils', () => {
    let testDir;
    (0, vitest_1.beforeEach)(() => {
        testDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'test-fs-utils-'));
        vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        vitest_1.vi.spyOn(console, 'warn').mockImplementation(() => { });
        vitest_1.vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    (0, vitest_1.afterEach)(() => {
        if (fs_1.default.existsSync(testDir)) {
            fs_1.default.rmSync(testDir, { recursive: true, force: true });
        }
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.describe)('safeJoin', () => {
        (0, vitest_1.it)('should join paths safely when file is inside base directory', () => {
            const baseDir = '/home/user/uploads';
            const fileName = 'video.mp4';
            const result = (0, file_system_utils_1.safeJoin)(baseDir, fileName);
            (0, vitest_1.expect)(result).toBe(path_1.default.join(baseDir, fileName));
        });
        (0, vitest_1.it)('should join paths safely for nested files', () => {
            const baseDir = '/home/user/uploads';
            const fileName = 'subfolder/video.mp4';
            const result = (0, file_system_utils_1.safeJoin)(baseDir, fileName);
            (0, vitest_1.expect)(result).toBe(path_1.default.resolve(baseDir, fileName));
        });
        (0, vitest_1.it)('should throw error for path traversal attack with ../', () => {
            const baseDir = '/home/user/uploads';
            const fileName = '../../../etc/passwd';
            (0, vitest_1.expect)(() => (0, file_system_utils_1.safeJoin)(baseDir, fileName)).toThrow('Invalid file path');
        });
        (0, vitest_1.it)('should throw error for path traversal with absolute path', () => {
            const baseDir = '/home/user/uploads';
            const fileName = '/etc/passwd';
            (0, vitest_1.expect)(() => (0, file_system_utils_1.safeJoin)(baseDir, fileName)).toThrow('Invalid file path');
        });
        (0, vitest_1.it)('should handle edge case with trailing separator in base', () => {
            const baseDir = testDir;
            const fileName = 'test.txt';
            const result = (0, file_system_utils_1.safeJoin)(baseDir, fileName);
            (0, vitest_1.expect)(result).toBe(path_1.default.join(baseDir, fileName));
            (0, vitest_1.expect)(result.startsWith(baseDir)).toBe(true);
        });
    });
    (0, vitest_1.describe)('createTempDir', () => {
        (0, vitest_1.it)('should create a temporary directory with given prefix', () => {
            const prefix = 'test-prefix-';
            const result = (0, file_system_utils_1.createTempDir)(prefix);
            (0, vitest_1.expect)(fs_1.default.existsSync(result)).toBe(true);
            (0, vitest_1.expect)(path_1.default.basename(result).startsWith(prefix)).toBe(true);
            fs_1.default.rmSync(result, { recursive: true, force: true });
        });
        (0, vitest_1.it)('should create directory in system temp folder', () => {
            const prefix = 'temp-test-';
            const result = (0, file_system_utils_1.createTempDir)(prefix);
            (0, vitest_1.expect)(result.startsWith(os_1.default.tmpdir())).toBe(true);
            fs_1.default.rmSync(result, { recursive: true, force: true });
        });
        (0, vitest_1.it)('should create unique directories on multiple calls', () => {
            const prefix = 'unique-test-';
            const dir1 = (0, file_system_utils_1.createTempDir)(prefix);
            const dir2 = (0, file_system_utils_1.createTempDir)(prefix);
            (0, vitest_1.expect)(dir1).not.toBe(dir2);
            (0, vitest_1.expect)(fs_1.default.existsSync(dir1)).toBe(true);
            (0, vitest_1.expect)(fs_1.default.existsSync(dir2)).toBe(true);
            fs_1.default.rmSync(dir1, { recursive: true, force: true });
            fs_1.default.rmSync(dir2, { recursive: true, force: true });
        });
    });
    (0, vitest_1.describe)('ensureDir', () => {
        (0, vitest_1.it)('should create directory if it does not exist', () => {
            const newDir = path_1.default.join(testDir, 'new-directory');
            (0, vitest_1.expect)(fs_1.default.existsSync(newDir)).toBe(false);
            (0, file_system_utils_1.ensureDir)(newDir);
            (0, vitest_1.expect)(fs_1.default.existsSync(newDir)).toBe(true);
        });
        (0, vitest_1.it)('should create nested directories recursively', () => {
            const nestedDir = path_1.default.join(testDir, 'level1', 'level2', 'level3');
            (0, vitest_1.expect)(fs_1.default.existsSync(nestedDir)).toBe(false);
            (0, file_system_utils_1.ensureDir)(nestedDir);
            (0, vitest_1.expect)(fs_1.default.existsSync(nestedDir)).toBe(true);
        });
        (0, vitest_1.it)('should not throw if directory already exists', () => {
            const existingDir = path_1.default.join(testDir, 'existing');
            fs_1.default.mkdirSync(existingDir);
            (0, vitest_1.expect)(() => (0, file_system_utils_1.ensureDir)(existingDir)).not.toThrow();
        });
    });
    (0, vitest_1.describe)('removeDir', () => {
        (0, vitest_1.it)('should remove an empty directory', () => {
            const dirToRemove = path_1.default.join(testDir, 'to-remove');
            fs_1.default.mkdirSync(dirToRemove);
            (0, vitest_1.expect)(fs_1.default.existsSync(dirToRemove)).toBe(true);
            (0, file_system_utils_1.removeDir)(dirToRemove);
            (0, vitest_1.expect)(fs_1.default.existsSync(dirToRemove)).toBe(false);
        });
        (0, vitest_1.it)('should remove directory with files', () => {
            const dirToRemove = path_1.default.join(testDir, 'dir-with-files');
            fs_1.default.mkdirSync(dirToRemove);
            fs_1.default.writeFileSync(path_1.default.join(dirToRemove, 'file1.txt'), 'content1');
            fs_1.default.writeFileSync(path_1.default.join(dirToRemove, 'file2.txt'), 'content2');
            (0, file_system_utils_1.removeDir)(dirToRemove);
            (0, vitest_1.expect)(fs_1.default.existsSync(dirToRemove)).toBe(false);
        });
        (0, vitest_1.it)('should remove nested directories', () => {
            const dirToRemove = path_1.default.join(testDir, 'nested-dir');
            const nestedPath = path_1.default.join(dirToRemove, 'level1', 'level2');
            fs_1.default.mkdirSync(nestedPath, { recursive: true });
            fs_1.default.writeFileSync(path_1.default.join(nestedPath, 'deep-file.txt'), 'deep content');
            (0, file_system_utils_1.removeDir)(dirToRemove);
            (0, vitest_1.expect)(fs_1.default.existsSync(dirToRemove)).toBe(false);
        });
        (0, vitest_1.it)('should not throw if directory does not exist', () => {
            const nonExistentDir = path_1.default.join(testDir, 'non-existent');
            (0, vitest_1.expect)(() => (0, file_system_utils_1.removeDir)(nonExistentDir)).not.toThrow();
        });
    });
    (0, vitest_1.describe)('zipDirectory', () => {
        (0, vitest_1.it)('should create a zip file from directory', async () => {
            const sourceDir = path_1.default.join(testDir, 'source');
            const zipPath = path_1.default.join(testDir, 'output.zip');
            fs_1.default.mkdirSync(sourceDir);
            fs_1.default.writeFileSync(path_1.default.join(sourceDir, 'file1.txt'), 'content1');
            fs_1.default.writeFileSync(path_1.default.join(sourceDir, 'file2.txt'), 'content2');
            await (0, file_system_utils_1.zipDirectory)(sourceDir, zipPath);
            (0, vitest_1.expect)(fs_1.default.existsSync(zipPath)).toBe(true);
            const stats = fs_1.default.statSync(zipPath);
            (0, vitest_1.expect)(stats.size).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should create a valid zip file with correct structure', async () => {
            const sourceDir = path_1.default.join(testDir, 'source-valid');
            const zipPath = path_1.default.join(testDir, 'valid-output.zip');
            fs_1.default.mkdirSync(sourceDir);
            fs_1.default.writeFileSync(path_1.default.join(sourceDir, 'test.txt'), 'test content');
            await (0, file_system_utils_1.zipDirectory)(sourceDir, zipPath);
            const zipBuffer = fs_1.default.readFileSync(zipPath);
            // ZIP files start with PK (0x504B)
            (0, vitest_1.expect)(zipBuffer[0]).toBe(0x50);
            (0, vitest_1.expect)(zipBuffer[1]).toBe(0x4b);
        });
        (0, vitest_1.it)('should handle empty directory', async () => {
            const emptyDir = path_1.default.join(testDir, 'empty-source');
            const zipPath = path_1.default.join(testDir, 'empty-output.zip');
            fs_1.default.mkdirSync(emptyDir);
            await (0, file_system_utils_1.zipDirectory)(emptyDir, zipPath);
            (0, vitest_1.expect)(fs_1.default.existsSync(zipPath)).toBe(true);
        });
        (0, vitest_1.it)('should handle nested directories', async () => {
            const sourceDir = path_1.default.join(testDir, 'nested-source');
            const nestedDir = path_1.default.join(sourceDir, 'subfolder', 'deep');
            const zipPath = path_1.default.join(testDir, 'nested-output.zip');
            fs_1.default.mkdirSync(nestedDir, { recursive: true });
            fs_1.default.writeFileSync(path_1.default.join(nestedDir, 'deep-file.txt'), 'deep content');
            await (0, file_system_utils_1.zipDirectory)(sourceDir, zipPath);
            (0, vitest_1.expect)(fs_1.default.existsSync(zipPath)).toBe(true);
            const stats = fs_1.default.statSync(zipPath);
            (0, vitest_1.expect)(stats.size).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should create empty zip when source directory does not exist', async () => {
            const nonExistentDir = path_1.default.join(testDir, 'non-existent-source');
            const zipPath = path_1.default.join(testDir, 'empty-output.zip');
            // archiver creates an empty zip when directory doesn't exist (no error thrown)
            await (0, file_system_utils_1.zipDirectory)(nonExistentDir, zipPath);
            (0, vitest_1.expect)(fs_1.default.existsSync(zipPath)).toBe(true);
        });
    });
});
//# sourceMappingURL=file-system.utils.test.js.map