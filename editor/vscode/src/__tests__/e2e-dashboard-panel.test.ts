/**
 * E2E Dashboard panel — getDashboardHtml 반환값 테스트
 */

import { describe, expect, it } from 'bun:test';
import { getDashboardHtml } from '../extension/e2e-dashboard-html';

describe('getDashboardHtml', () => {
  it('지정 URL이 iframe src와 hint에 포함된다', () => {
    const url = 'http://127.0.0.1:9323/';
    const html = getDashboardHtml(url, 'vscode-webview://abc');

    expect(html).toContain(`<iframe src="${url}"`);
    expect(html).toContain(`Dashboard: ${url}`);
  });

  it('CSP frame-src에 origin만 포함 (끝 슬래시 제거)', () => {
    const html = getDashboardHtml('http://127.0.0.1:9323/', 'vscode-webview://abc');

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('frame-src http://127.0.0.1:9323');
    expect(html).not.toContain('frame-src http://127.0.0.1:9323/');
  });

  it('다른 포트일 때 해당 포트가 iframe src에 반영', () => {
    const url = 'http://127.0.0.1:9999/';
    const html = getDashboardHtml(url, 'x');

    expect(html).toContain('http://127.0.0.1:9999/');
    expect(html).toContain('frame-src http://127.0.0.1:9999');
  });

  it('dashboard:show 안내 문구 포함', () => {
    const html = getDashboardHtml('http://127.0.0.1:9323/', 'x');

    expect(html).toContain('bun run dashboard:show');
  });

  it('유효한 HTML 문서 구조', () => {
    const html = getDashboardHtml('http://127.0.0.1:9323/', 'x');

    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });
});
