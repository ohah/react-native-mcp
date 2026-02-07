/**
 * dist/index.js에 실행 권한 부여 (Unix). Windows에서는 no-op.
 * 빌드 후 bin 실행 시 Permission denied 방지.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, '..', 'dist', 'index.js');

if (!fs.existsSync(target)) {
  console.error(`[chmod-dist] Expected build output not found: ${target}`);
  process.exitCode = 1;
} else if (process.platform !== 'win32') {
  fs.chmodSync(target, 0o755);
}
