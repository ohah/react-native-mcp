import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  createMcpClient,
  launchApp,
  waitForAppConnection,
  waitForAppReady,
  callTool,
} from './helpers';

// 환경변수로 플랫폼 지정 (기본: android)
const TEST_PLATFORM = (process.env.E2E_PLATFORM ?? 'android') as 'android' | 'ios';

/**
 * E2E 스모크 테스트
 *
 * 사전 조건:
 *   - Android: 에뮬레이터에 데모앱 설치·실행 중 + adb reverse tcp:12300 tcp:12300
 *   - iOS: 시뮬레이터에 데모앱 설치·실행 중
 *
 * 이 테스트가 MCP 서버를 spawn하고 앱 연결을 대기한 뒤 도구를 호출합니다.
 */
describe('E2E Smoke', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient());
    await launchApp(TEST_PLATFORM);
    await waitForAppConnection(client, 90_000);
    await waitForAppReady(client, 30_000);
  }, 120_000);

  afterAll(async () => {
    await transport.close();
  });

  it('get_debugger_status: 디바이스 연결 확인', async () => {
    const status = await callTool(client, 'get_debugger_status', {});
    expect(status.appConnected).toBe(true);
    expect(status.devices.length).toBeGreaterThanOrEqual(1);
    expect(status.devices[0]).toHaveProperty('deviceId');
    expect(status.devices[0]).toHaveProperty('platform');
  });

  it('take_snapshot: 컴포넌트 트리 반환', async () => {
    const tree = await callTool(client, 'take_snapshot', {});
    expect(tree).toBeDefined();
    // 트리는 중첩 객체 또는 문자열
    const str = typeof tree === 'string' ? tree : JSON.stringify(tree);
    expect(str.length).toBeGreaterThan(100);
  });

  it('query_selector: 요소 검색 + measure 포함', async () => {
    const el = await callTool(client, 'query_selector', {
      selector: 'Text:nth(0)',
    });
    expect(el).toBeDefined();
    expect(el).toHaveProperty('uid');
    expect(el).toHaveProperty('type');
    expect(el).toHaveProperty('measure');
    if (el.measure) {
      expect(el.measure).toHaveProperty('pageX');
      expect(el.measure).toHaveProperty('pageY');
    }
  });

  it('query_selector_all: 복수 요소 반환', async () => {
    const els = await callTool(client, 'query_selector_all', {
      selector: ':has-press',
    });
    expect(Array.isArray(els)).toBe(true);
    expect(els.length).toBeGreaterThan(0);
  });

  it('assert_text: 데모앱 네비게이션 텍스트 확인', async () => {
    // 스텝 네비게이션의 "다음" 버튼 텍스트 확인
    const result = await callTool(client, 'assert_text', { text: '다음' });
    expect(result.pass).toBe(true);
  });

  it('assert_text: 존재하지 않는 텍스트 → FAIL', async () => {
    const result = await callTool(client, 'assert_text', {
      text: '__NONEXISTENT_TEXT_12345__',
    });
    expect(result.pass).toBe(false);
  });

  // ─── Phase 0: 신규 assertion 도구 ─────────────────────────────

  it('assert_text + polling: timeoutMs 파라미터 동작', async () => {
    // 존재하는 텍스트를 polling으로 찾기 — 즉시 성공해야 함
    const result = await callTool(client, 'assert_text', {
      text: 'Count',
      timeoutMs: 3000,
      intervalMs: 300,
    });
    expect(result.pass).toBe(true);
  });

  it('assert_visible + polling: timeoutMs 파라미터 동작', async () => {
    const result = await callTool(client, 'assert_visible', {
      selector: '#press-counter-button',
      timeoutMs: 3000,
    });
    expect(result.pass).toBe(true);
  });

  it('assert_not_visible: 존재하지 않는 요소 → PASS', async () => {
    const result = await callTool(client, 'assert_not_visible', {
      selector: '#__nonexistent_element__',
    });
    expect(result.pass).toBe(true);
  });

  it('assert_not_visible: 존재하는 요소 → FAIL', async () => {
    const result = await callTool(client, 'assert_not_visible', {
      selector: '#press-counter-button',
    });
    expect(result.pass).toBe(false);
  });

  it('assert_element_count: minCount로 pressable 요소 확인', async () => {
    const result = await callTool(client, 'assert_element_count', {
      selector: ':has-press',
      minCount: 1,
    });
    expect(result.pass).toBe(true);
    expect(result.actualCount).toBeGreaterThanOrEqual(1);
  });

  it('assert_element_count: expectedCount 불일치 → FAIL', async () => {
    const result = await callTool(client, 'assert_element_count', {
      selector: '#press-counter-button',
      expectedCount: 999,
    });
    expect(result.pass).toBe(false);
  });

  // ─── 기존 도구 ──────────────────────────────────────────────────

  // CI에서 idb/adb 스크린샷이 5초를 넘길 수 있으므로 타임아웃 확대
  it('take_screenshot: 이미지 반환', async () => {
    const res = await client.callTool({
      name: 'take_screenshot',
      arguments: { platform: TEST_PLATFORM },
    });
    const content = res.content as Array<{
      type: string;
      data?: string;
      mimeType?: string;
      text?: string;
    }>;
    // 스크린샷은 image 타입 또는 base64 텍스트로 반환
    const hasImage = content.some((c) => c.type === 'image' || (c.data && c.data.length > 100));
    const hasBase64Text = content.some((c) => c.type === 'text' && c.text && c.text.length > 1000);
    expect(hasImage || hasBase64Text).toBe(true);
  }, 30_000);
});
