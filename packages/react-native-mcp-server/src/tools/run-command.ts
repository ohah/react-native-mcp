/**
 * 공유 CLI 명령 실행 유틸리티
 * take-screenshot, idb 도구 등 호스트 CLI를 실행하는 모든 도구에서 사용.
 */

import { spawn } from 'node:child_process';

export function runCommand(
  command: string,
  args: string[],
  options?: { stdin?: Buffer; timeoutMs?: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options?.stdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout?.on('data', (chunk: Buffer) => outChunks.push(chunk));
    proc.stderr?.on('data', (chunk: Buffer) => errChunks.push(chunk));
    const timeout =
      options?.timeoutMs != null
        ? setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error('Command timed out'));
          }, options.timeoutMs)
        : undefined;
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString('utf8').slice(0, 300);
        reject(new Error(`Command failed with code ${code}. ${stderr}`));
        return;
      }
      resolve(Buffer.concat(outChunks));
    });
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    if (options?.stdin && proc.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    }
  });
}
