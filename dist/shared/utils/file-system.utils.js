"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJoin = safeJoin;
exports.createTempDir = createTempDir;
exports.ensureDir = ensureDir;
exports.removeDir = removeDir;
exports.zipDirectory = zipDirectory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const archiver_1 = __importDefault(require("archiver"));
function safeJoin(baseDir, fileName) {
    const full = path_1.default.resolve(baseDir, fileName);
    if (!full.startsWith(baseDir + path_1.default.sep)) {
        throw new Error('Invalid file path');
    }
    return full;
}
function createTempDir(prefix) {
    return fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), prefix));
}
function ensureDir(dirPath) {
    fs_1.default.mkdirSync(dirPath, { recursive: true });
}
function removeDir(dirPath) {
    fs_1.default.rmSync(dirPath, { recursive: true, force: true });
}
async function zipDirectory(dirPath, zipPath) {
    return new Promise((resolve, reject) => {
        const output = fs_1.default.createWriteStream(zipPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(dirPath, false);
        archive.finalize();
    });
}
//# sourceMappingURL=file-system.utils.js.map