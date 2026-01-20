import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  safeJoin,
  createTempDir,
  ensureDir,
  removeDir,
  zipDirectory,
} from '../../../shared/utils/file-system.utils';

describe('file-system.utils', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-fs-utils-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('safeJoin', () => {
    it('should join paths safely when file is inside base directory', () => {
      const baseDir = '/home/user/uploads';
      const fileName = 'video.mp4';

      const result = safeJoin(baseDir, fileName);

      expect(result).toBe(path.join(baseDir, fileName));
    });

    it('should join paths safely for nested files', () => {
      const baseDir = '/home/user/uploads';
      const fileName = 'subfolder/video.mp4';

      const result = safeJoin(baseDir, fileName);

      expect(result).toBe(path.resolve(baseDir, fileName));
    });

    it('should throw error for path traversal attack with ../', () => {
      const baseDir = '/home/user/uploads';
      const fileName = '../../../etc/passwd';

      expect(() => safeJoin(baseDir, fileName)).toThrow('Invalid file path');
    });

    it('should throw error for path traversal with absolute path', () => {
      const baseDir = '/home/user/uploads';
      const fileName = '/etc/passwd';

      expect(() => safeJoin(baseDir, fileName)).toThrow('Invalid file path');
    });

    it('should handle edge case with trailing separator in base', () => {
      const baseDir = testDir;
      const fileName = 'test.txt';

      const result = safeJoin(baseDir, fileName);

      expect(result).toBe(path.join(baseDir, fileName));
      expect(result.startsWith(baseDir)).toBe(true);
    });
  });

  describe('createTempDir', () => {
    it('should create a temporary directory with given prefix', () => {
      const prefix = 'test-prefix-';

      const result = createTempDir(prefix);

      expect(fs.existsSync(result)).toBe(true);
      expect(path.basename(result).startsWith(prefix)).toBe(true);

      fs.rmSync(result, { recursive: true, force: true });
    });

    it('should create directory in system temp folder', () => {
      const prefix = 'temp-test-';

      const result = createTempDir(prefix);

      expect(result.startsWith(os.tmpdir())).toBe(true);

      fs.rmSync(result, { recursive: true, force: true });
    });

    it('should create unique directories on multiple calls', () => {
      const prefix = 'unique-test-';

      const dir1 = createTempDir(prefix);
      const dir2 = createTempDir(prefix);

      expect(dir1).not.toBe(dir2);
      expect(fs.existsSync(dir1)).toBe(true);
      expect(fs.existsSync(dir2)).toBe(true);

      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
    });
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', () => {
      const newDir = path.join(testDir, 'new-directory');

      expect(fs.existsSync(newDir)).toBe(false);

      ensureDir(newDir);

      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should create nested directories recursively', () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3');

      expect(fs.existsSync(nestedDir)).toBe(false);

      ensureDir(nestedDir);

      expect(fs.existsSync(nestedDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      const existingDir = path.join(testDir, 'existing');
      fs.mkdirSync(existingDir);

      expect(() => ensureDir(existingDir)).not.toThrow();
    });
  });

  describe('removeDir', () => {
    it('should remove an empty directory', () => {
      const dirToRemove = path.join(testDir, 'to-remove');
      fs.mkdirSync(dirToRemove);

      expect(fs.existsSync(dirToRemove)).toBe(true);

      removeDir(dirToRemove);

      expect(fs.existsSync(dirToRemove)).toBe(false);
    });

    it('should remove directory with files', () => {
      const dirToRemove = path.join(testDir, 'dir-with-files');
      fs.mkdirSync(dirToRemove);
      fs.writeFileSync(path.join(dirToRemove, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(dirToRemove, 'file2.txt'), 'content2');

      removeDir(dirToRemove);

      expect(fs.existsSync(dirToRemove)).toBe(false);
    });

    it('should remove nested directories', () => {
      const dirToRemove = path.join(testDir, 'nested-dir');
      const nestedPath = path.join(dirToRemove, 'level1', 'level2');
      fs.mkdirSync(nestedPath, { recursive: true });
      fs.writeFileSync(path.join(nestedPath, 'deep-file.txt'), 'deep content');

      removeDir(dirToRemove);

      expect(fs.existsSync(dirToRemove)).toBe(false);
    });

    it('should not throw if directory does not exist', () => {
      const nonExistentDir = path.join(testDir, 'non-existent');

      expect(() => removeDir(nonExistentDir)).not.toThrow();
    });
  });

  describe('zipDirectory', () => {
    it('should create a zip file from directory', async () => {
      const sourceDir = path.join(testDir, 'source');
      const zipPath = path.join(testDir, 'output.zip');
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(sourceDir, 'file2.txt'), 'content2');

      await zipDirectory(sourceDir, zipPath);

      expect(fs.existsSync(zipPath)).toBe(true);
      const stats = fs.statSync(zipPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should create a valid zip file with correct structure', async () => {
      const sourceDir = path.join(testDir, 'source-valid');
      const zipPath = path.join(testDir, 'valid-output.zip');
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, 'test.txt'), 'test content');

      await zipDirectory(sourceDir, zipPath);

      const zipBuffer = fs.readFileSync(zipPath);
      // ZIP files start with PK (0x504B)
      expect(zipBuffer[0]).toBe(0x50);
      expect(zipBuffer[1]).toBe(0x4b);
    });

    it('should handle empty directory', async () => {
      const emptyDir = path.join(testDir, 'empty-source');
      const zipPath = path.join(testDir, 'empty-output.zip');
      fs.mkdirSync(emptyDir);

      await zipDirectory(emptyDir, zipPath);

      expect(fs.existsSync(zipPath)).toBe(true);
    });

    it('should handle nested directories', async () => {
      const sourceDir = path.join(testDir, 'nested-source');
      const nestedDir = path.join(sourceDir, 'subfolder', 'deep');
      const zipPath = path.join(testDir, 'nested-output.zip');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'deep-file.txt'), 'deep content');

      await zipDirectory(sourceDir, zipPath);

      expect(fs.existsSync(zipPath)).toBe(true);
      const stats = fs.statSync(zipPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should create empty zip when source directory does not exist', async () => {
      const nonExistentDir = path.join(testDir, 'non-existent-source');
      const zipPath = path.join(testDir, 'empty-output.zip');

      // archiver creates an empty zip when directory doesn't exist (no error thrown)
      await zipDirectory(nonExistentDir, zipPath);

      expect(fs.existsSync(zipPath)).toBe(true);
    });
  });
});
