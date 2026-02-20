import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { buildIndexHtml } from './reporters/dashboard.js';

const DEFAULT_PORT = 9323;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

export interface ShowReportOptions {
  port?: number;
  /** false면 브라우저를 열지 않음 (테스트용) */
  openBrowser?: boolean;
}

/**
 * 디렉터리를 정적 서빙하고 (선택) 브라우저를 연다.
 * @returns 서버 인스턴스. 호출자가 server.close()로 종료해야 함.
 */
export function showReport(directory: string, options: ShowReportOptions = {}): Promise<Server> {
  const port = options.port ?? DEFAULT_PORT;
  const openBrowser = options.openBrowser !== false;

  return new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end();
        return;
      }
      const url = req.url === '/' ? '/index.html' : req.url;
      const rawPath = url.replace(/\?.*$/, '').replace(/^\/+/, '') || 'index.html';
      // index.html은 항상 현재 코드로 생성해 서빙 (디스크 파일은 옛 UI일 수 있음)
      if (rawPath === 'index.html') {
        try {
          const html = buildIndexHtml();
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (err) {
          res.writeHead(500);
          res.end(String(err));
        }
        return;
      }
      const filePath = resolve(join(directory, rawPath));
      const dirResolved = resolve(directory);
      if (!filePath.startsWith(dirResolved) || filePath === dirResolved) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      try {
        const body = readFileSync(filePath);
        const ext = extname(filePath);
        const contentType = MIME[ext] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(body);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}/`;
      if (openBrowser) {
        try {
          if (platform() === 'darwin') {
            execSync(`open "${url}"`, { stdio: 'ignore' });
          } else if (platform() === 'win32') {
            execSync(`start "${url}"`, { stdio: 'ignore' });
          } else {
            execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
          }
        } catch {
          // ignore; server still running
        }
      }
      resolvePromise(server);
    });

    server.on('error', reject);
  });
}
