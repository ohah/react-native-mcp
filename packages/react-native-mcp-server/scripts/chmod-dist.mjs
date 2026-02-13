/**
 * dist/index.js에 실행 권한 부여 (Unix). Windows에서는 no-op.
 * 빌드 후 bin 실행 시 Permission denied 방지.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const distIndex = path.join(pkgRoot, 'dist', 'index.js');
const runScript = path.join(pkgRoot, 'run-mcp-server.sh');

if (!fs.existsSync(distIndex)) {
  console.error(`[chmod-dist] Expected build output not found: ${distIndex}`);
  process.exitCode = 1;
} else if (process.platform !== 'win32') {
  fs.chmodSync(distIndex, 0o755);
  if (fs.existsSync(runScript)) fs.chmodSync(runScript, 0o755);
}
