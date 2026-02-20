import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { get as httpGet } from 'node:http';
import { showReport } from '../../test/show-report.js';

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    httpGet(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
      );
    }).on('error', reject);
  });
}

describe('showReport', () => {
  let tmp: string;
  let server: Awaited<ReturnType<typeof showReport>>;

  beforeEach(() => {
    tmp = join(tmpdir(), `show-report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'index.html'), '<html><body>Dashboard</body></html>', 'utf-8');
    writeFileSync(join(tmp, 'runs.json'), '[]', 'utf-8');
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (existsSync(tmp)) rmSync(tmp, { recursive: true });
  });

  it('GET / 시 buildIndexHtml()로 생성한 대시보드 HTML 반환 (디스크 index.html 미사용)', async () => {
    server = await showReport(tmp, { port: 0, openBrowser: false });
    const port = (server.address() as { port: number }).port;
    const res = await get(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('E2E Dashboard');
    expect(res.body).toContain('Loading...');
    expect(res.body).toContain("fetch('./runs.json')");
    expect(res.body).toContain('toggleStepDetail');
  });

  it('GET /runs.json 시 해당 파일 내용 반환', async () => {
    server = await showReport(tmp, { port: 0, openBrowser: false });
    const port = (server.address() as { port: number }).port;
    const res = await get(`http://127.0.0.1:${port}/runs.json`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('[]');
  });

  it('존재하지 않는 경로는 404', async () => {
    server = await showReport(tmp, { port: 0, openBrowser: false });
    const port = (server.address() as { port: number }).port;
    const res = await get(`http://127.0.0.1:${port}/nonexistent.html`);
    expect(res.status).toBe(404);
  });

  it('openBrowser: false 시 서버만 기동하고 resolve', async () => {
    server = await showReport(tmp, { port: 0, openBrowser: false });
    expect(server).toBeDefined();
    expect((server.address() as { port: number }).port).toBeGreaterThan(0);
  });
});
