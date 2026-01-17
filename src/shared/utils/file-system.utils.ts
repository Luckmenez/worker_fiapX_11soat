import fs from 'fs';
import path from 'path';
import os from 'os';
import archiver from 'archiver';

export function safeJoin(baseDir: string, fileName: string): string {
  const full = path.resolve(baseDir, fileName);
  if (!full.startsWith(baseDir + path.sep)) {
    throw new Error('Invalid file path');
  }
  return full;
}

export function createTempDir(prefix: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  console.log(`[FS-UTILS] Diretório temporário criado: ${tmpDir}`);
  return tmpDir;
}

export function ensureDir(dirPath: string): void {
  console.log(`[FS-UTILS] Garantindo existência do diretório: ${dirPath}`);
  fs.mkdirSync(dirPath, { recursive: true });
}

export function removeDir(dirPath: string): void {
  console.log(`[FS-UTILS] Removendo diretório: ${dirPath}`);
  const startTime = Date.now();
  fs.rmSync(dirPath, { recursive: true, force: true });
  console.log(`[FS-UTILS] Diretório removido em ${Date.now() - startTime}ms`);
}

export async function zipDirectory(dirPath: string, zipPath: string): Promise<void> {
  console.log(`[FS-UTILS] Iniciando zipDirectory`);
  console.log(`[FS-UTILS] Origem: ${dirPath}`);
  console.log(`[FS-UTILS] Destino: ${zipPath}`);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

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
