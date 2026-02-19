/**
 * Entrypoint que carrega as variáveis de ambiente do .env
 * ANTES de executar o main.ts.
 *
 * Como o módulo é CommonJS, os imports estáticos são resolvidos
 * na ordem do arquivo — então lemos o .env aqui antes de
 * chamar require('./main'), garantindo que process.env esteja
 * populado quando o tsyringe resolver o S3Gateway.
 */
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  console.log('[ENV] Variáveis de ambiente carregadas de .env');
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./main');
