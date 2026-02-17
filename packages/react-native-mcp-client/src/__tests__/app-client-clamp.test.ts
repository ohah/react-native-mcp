import { describe, expect, it, mock } from 'bun:test';

// ─── Mock MCP SDK ────────────────────────────────────────────

const mockCallTool = mock((_args: unknown) =>
  Promise.resolve({ content: [{ type: 'text', text: '{}' }], isError: false })
);

mock.module('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    async connect() {}
    callTool = mockCallTool;
  },
}));

mock.module('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {
    async close() {}
  },
}));

// ─── Import after mocks ─────────────────────────────────────

const { AppClient } = await import('../app-client.js');

// ─── Helpers ─────────────────────────────────────────────────

const SCREEN = { width: 390, height: 844 };

function setupMocks(measure: { pageX: number; pageY: number; width: number; height: number }) {
  mockCallTool.mockReset();
  mockCallTool.mockImplementation((req: { name: string }) => {
    if (req.name === 'query_selector') {
      return Promise.resolve({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              uid: 'test-uid',
              type: 'View',
              measure,
            }),
          },
        ],
        isError: false,
      });
    }
    if (req.name === 'evaluate_script') {
      return Promise.resolve({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ window: SCREEN }),
          },
        ],
        isError: false,
      });
    }
    // tap, swipe — just return ok
    return Promise.resolve({
      content: [{ type: 'text', text: '"ok"' }],
      isError: false,
    });
  });
}

async function createTestClient(): Promise<Awaited<ReturnType<typeof AppClient.create>>> {
  return AppClient.create({
    platform: 'ios',
    launchApp: false,
    serverCwd: '/tmp',
  });
}

function getLastTapArgs(): { x: number; y: number } | null {
  const tapCall = mockCallTool.mock.calls.find(
    (c: unknown[]) => (c[0] as { name: string }).name === 'tap'
  );
  if (!tapCall) return null;
  const args = (tapCall[0] as { arguments: Record<string, unknown> }).arguments;
  return { x: args.x as number, y: args.y as number };
}

function getLastSwipeArgs(): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} | null {
  const swipeCall = mockCallTool.mock.calls.find(
    (c: unknown[]) => (c[0] as { name: string }).name === 'swipe'
  );
  if (!swipeCall) return null;
  const args = (swipeCall[0] as { arguments: Record<string, unknown> }).arguments;
  return {
    x1: args.x1 as number,
    y1: args.y1 as number,
    x2: args.x2 as number,
    y2: args.y2 as number,
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe('AppClient.tap() viewport clamping', () => {
  it('center 화면 밖 → visible rect 중앙으로 tapXY 호출', async () => {
    // bottom sheet: element center at y=880, beyond screen (844)
    // visible rect: top=700, bottom=844 → center = 772
    const measure = { pageX: 0, pageY: 700, width: 390, height: 360 };
    setupMocks(measure);
    const app = await createTestClient();
    await app.tap('View:text("Bottom sheet")');
    const tap = getLastTapArgs();
    expect(tap).not.toBeNull();
    expect(tap!.x).toBe(195); // cx unchanged
    expect(tap!.y).toBe(772); // visible rect center: (700+844)/2
  });

  it('center 화면 안 → 원래 좌표 그대로', async () => {
    const measure = { pageX: 50, pageY: 100, width: 200, height: 100 };
    setupMocks(measure);
    const app = await createTestClient();
    await app.tap('#my-button');
    const tap = getLastTapArgs();
    expect(tap).not.toBeNull();
    expect(tap!.x).toBe(150); // 50 + 200/2
    expect(tap!.y).toBe(150); // 100 + 100/2
  });
});

describe('AppClient.swipe() viewport clamping', () => {
  it('center 화면 밖 → visible rect 중앙으로 swipe 좌표 계산', async () => {
    // bottom sheet: element center at y=880
    // visible rect: top=700, bottom=844 → center = 772
    const measure = { pageX: 0, pageY: 700, width: 390, height: 360 };
    setupMocks(measure);
    const app = await createTestClient();
    await app.swipe('View:text("Bottom sheet")', {
      direction: 'up',
      distance: 200,
    });
    const swipe = getLastSwipeArgs();
    expect(swipe).not.toBeNull();
    // clamped cy = 772 (visible rect center)
    // up: x1=cx, y1=cy+100, x2=cx, y2=cy-100
    expect(swipe!.x1).toBe(195);
    expect(swipe!.y1).toBe(844); // 772+100=872 → clampCoord → 844
    expect(swipe!.x2).toBe(195);
    expect(swipe!.y2).toBe(672); // 772-100
  });

  it('center 화면 안 → 원래 좌표 그대로', async () => {
    const measure = { pageX: 50, pageY: 300, width: 200, height: 200 };
    setupMocks(measure);
    const app = await createTestClient();
    await app.swipe('#my-element', { direction: 'up', distance: 100 });
    const swipe = getLastSwipeArgs();
    expect(swipe).not.toBeNull();
    // cx=150, cy=400
    // up: y1=400+50=450, y2=400-50=350
    expect(swipe!.x1).toBe(150);
    expect(swipe!.y1).toBe(450);
    expect(swipe!.x2).toBe(150);
    expect(swipe!.y2).toBe(350);
  });

  it('최종 swipe 좌표가 screen bounds로 clamp됨', async () => {
    // element near bottom: center at y=830 (in screen)
    // swipe down distance=200 → y2 = 830+100 = 930 → clamped to 844
    const measure = { pageX: 100, pageY: 780, width: 190, height: 100 };
    setupMocks(measure);
    const app = await createTestClient();
    await app.swipe('#near-bottom', { direction: 'down', distance: 200 });
    const swipe = getLastSwipeArgs();
    expect(swipe).not.toBeNull();
    // cy=830, down: y1=830-100=730, y2=830+100=930→844
    expect(swipe!.y1).toBe(730);
    expect(swipe!.y2).toBe(844); // clamped
  });
});
