import { describe, expect, it } from 'bun:test';
import { clampToViewport, clampCoord, OffScreenError } from '../../client/viewport-clamp.js';

const SCREEN = { width: 390, height: 844 };

describe('clampToViewport', () => {
  it('center가 화면 안일 때 → 변경 없음', () => {
    const measure = { pageX: 50, pageY: 100, width: 200, height: 100 };
    const cx = 150; // 50 + 200/2
    const cy = 150; // 100 + 100/2
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result).toEqual({ cx: 150, cy: 150 });
  });

  it('center가 화면 아래로 벗어났을 때 (bottom sheet) → visible rect 중앙으로 clamp', () => {
    // element: pageY=700, height=360 → bottom edge = 1060 > 844
    // visible rect: top=700, bottom=844 → center = 772
    // element center: 700+180 = 880 (화면 밖)
    const measure = { pageX: 0, pageY: 700, width: 390, height: 360 };
    const cx = 195;
    const cy = 880;
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result.cx).toBe(195);
    expect(result.cy).toBe(772); // visible rect center: (700+844)/2
  });

  it('center가 화면 위로 벗어났을 때 → top으로 clamp', () => {
    // element: pageY=-100, height=200 → top=-100, bottom=100
    // visible rect: top=0, bottom=100
    // center: -100+100 = 0 → actually 0 is at the edge
    // Let's make center clearly above: pageY=-200, height=100 → center=-150
    // visible rect: none (bottom = -100 < 0)
    // Actually let's do partial overlap: pageY=-100, height=200
    // visible: top=0, bottom=100, center = -100+100=0
    const measure = { pageX: 50, pageY: -100, width: 200, height: 200 };
    const cx = 150;
    const cy = 0; // -100 + 200/2 = 0
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result.cx).toBe(150);
    expect(result.cy).toBe(0); // at top edge, already valid
  });

  it('center가 화면 위로 크게 벗어났을 때 → visible rect 중앙으로 clamp', () => {
    // element: pageY=-300, height=400 → bottom=100
    // visible rect: top=0, bottom=100 → center = 50
    // element center: -300+200 = -100 (화면 밖)
    const measure = { pageX: 50, pageY: -300, width: 200, height: 400 };
    const cx = 150;
    const cy = -100;
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result.cx).toBe(150);
    expect(result.cy).toBe(50); // visible rect center: (0+100)/2
  });

  it('center가 화면 좌측으로 벗어났을 때 → x축 visible rect 중앙으로 clamp', () => {
    const measure = { pageX: -200, pageY: 100, width: 300, height: 100 };
    const cx = -50; // -200 + 300/2
    const cy = 150;
    // visible rect: left=0, right=100 → center = 50
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result.cx).toBe(50); // visible rect center: (0+100)/2
    expect(result.cy).toBe(150);
  });

  it('center가 화면 우측으로 벗어났을 때 → x축 visible rect 중앙으로 clamp', () => {
    const measure = { pageX: 300, pageY: 100, width: 200, height: 100 };
    const cx = 400; // 300 + 200/2
    const cy = 150;
    // visible rect: left=300, right=390 → center = 345
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result.cx).toBe(345); // visible rect center: (300+390)/2
    expect(result.cy).toBe(150);
  });

  it('element가 완전히 화면 밖일 때 → OffScreenError throw', () => {
    // completely below screen
    const measure = { pageX: 50, pageY: 900, width: 200, height: 100 };
    const cx = 150;
    const cy = 950;
    expect(() => clampToViewport(cx, cy, measure, SCREEN)).toThrow(OffScreenError);
  });

  it('element가 완전히 화면 위에 있을 때 → OffScreenError throw', () => {
    const measure = { pageX: 50, pageY: -200, width: 200, height: 100 };
    const cx = 150;
    const cy = -150;
    expect(() => clampToViewport(cx, cy, measure, SCREEN)).toThrow(OffScreenError);
  });

  it('element가 화면과 부분 겹침 (아래쪽) → visible rect 중앙으로 clamp', () => {
    // element top=800, bottom=900. screen bottom=844
    // visible rect: top=800, bottom=844 → center = 822
    // element center = 850 (밖)
    const measure = { pageX: 100, pageY: 800, width: 200, height: 100 };
    const cx = 200;
    const cy = 850;
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result.cx).toBe(200);
    expect(result.cy).toBe(822); // visible rect center: (800+844)/2
  });

  it('transform 없는 일반 요소 (center가 화면 안) → 변경 없음', () => {
    const measure = { pageX: 100, pageY: 400, width: 190, height: 44 };
    const cx = 195; // 100 + 190/2
    const cy = 422; // 400 + 44/2
    const result = clampToViewport(cx, cy, measure, SCREEN);
    expect(result).toEqual({ cx: 195, cy: 422 });
  });
});

describe('clampCoord', () => {
  it('화면 안 좌표 → 변경 없음', () => {
    expect(clampCoord(100, 200, SCREEN)).toEqual({ x: 100, y: 200 });
  });

  it('음수 좌표 → 0으로 clamp', () => {
    expect(clampCoord(-10, -20, SCREEN)).toEqual({ x: 0, y: 0 });
  });

  it('화면 밖 좌표 → screen bounds로 clamp', () => {
    expect(clampCoord(500, 1000, SCREEN)).toEqual({ x: 390, y: 844 });
  });
});
