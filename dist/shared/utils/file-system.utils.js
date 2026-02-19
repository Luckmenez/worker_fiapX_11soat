"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJoin = safeJoin;
exports.createTempDir = createTempDir;
exports.ensureDir = ensureDir;
exports.removeDir = removeDir;
exports.removeFile = removeFile;
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
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), prefix));
    console.log(`[FS-UTILS] Diretório temporário criado: ${tmpDir}`);
    return tmpDir;
}
function ensureDir(dirPath) {
    console.log(`[FS-UTILS] Garantindo existência do diretório: ${dirPath}`);
    fs_1.default.mkdirSync(dirPath, { recursive: true });
}
function removeDir(dirPath) {
    console.log(`[FS-UTILS] Removendo diretório: ${dirPath}`);
    const startTime = Date.now();
    fs_1.default.rmSync(dirPath, { recursive: true, force: true });
    console.log(`[FS-UTILS] Diretório removido em ${Date.now() - startTime}ms`);
}
function removeFile(filePath) {
    console.log(`[FS-UTILS] Removendo arquivo: ${filePath}`);
    if (fs_1.default.existsSync(filePath)) {
        fs_1.default.unlinkSync(filePath);
        console.log(`[FS-UTILS] Arquivo removido: ${filePath}`);
    }
    else {
        console.log(`[FS-UTILS] Arquivo não encontrado para remoção: ${filePath}`);
    }
}
async function zipDirectory(dirPath, zipPath) {
    console.log(`[FS-UTILS] Iniciando zipDirectory`);
    console.log(`[FS-UTILS] Origem: ${dirPath}`);
    console.log(`[FS-UTILS] Destino: ${zipPath}`);
    return new Promise((resolve, reject) => {
        const output = fs_1.default.createWriteStream(zipPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        let lastProgressLog = Date.now();
        let totalBytes = 0;
        // Log de progresso a cada 10 segundos
        const progressInterval = setInterval(() => {
            console.log(`[FS-UTILS] ZIP em progresso... (${(totalBytes / 1024 / 1024).toFixed(2)} MB processados)`);
        }, 10000);
        archive.on('progress', (progress) => {
            totalBytes = progress.fs.processedBytes;
            const now = Date.now();
            // Log a cada 5 segundos ou quando houver mudança significativa
            if (now - lastProgressLog > 5000) {
                console.log(`[FS-UTILS] ZIP progresso: ${progress.entries.processed}/${progress.entries.total} arquivos, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
                lastProgressLog = now;
            }
        });
        output.on('close', () => {
            clearInterval(progressInterval);
            const finalSize = archive.pointer();
            console.log(`[FS-UTILS] ZIP concluído! Tamanho final: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
            resolve();
        });
        output.on('error', (err) => {
            clearInterval(progressInterval);
            console.error(`[FS-UTILS] Erro no output stream: ${err.message}`);
            reject(err);
        });
        archive.on('error', (err) => {
            clearInterval(progressInterval);
            console.error(`[FS-UTILS] Erro no archiver: ${err.message}`);
            reject(err);
        });
        archive.on('warning', (err) => {
            console.warn(`[FS-UTILS] Aviso do archiver: ${err.message}`);
        });
        console.log(`[FS-UTILS] Iniciando pipe do archive...`);
        archive.pipe(output);
        console.log(`[FS-UTILS] Adicionando diretório ao archive...`);
        archive.directory(dirPath, false);
        console.log(`[FS-UTILS] Finalizando archive...`);
        archive.finalize();
    });
}
//# sourceMappingURL=file-system.utils.js.map