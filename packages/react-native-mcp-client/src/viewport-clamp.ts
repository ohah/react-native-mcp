/**
 * Viewport clamping — element center를 화면에 보이는 영역(visible rect)으로 제한.
 *
 * Reanimated translateY 등 transform이 measureInWindow에 포함되어
 * element center가 화면 밖으로 계산되는 문제를 해결한다.
 */

export interface Measure {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

export interface ScreenBounds {
  width: number;
  height: number;
}

/**
 * element bounds와 screen bounds의 교차 영역(visible rect)을 구하고,
 * center를 해당 영역 내부로 clamp한다.
 *
 * visible rect가 없으면(완전히 화면 밖) 원래 center를 그대로 반환.
 */
export function clampToViewport(
  cx: number,
  cy: number,
  measure: Measure,
  screen: ScreenBounds
): { cx: number; cy: number } {
  // element bounds
  const elLeft = measure.pageX;
  const elTop = measure.pageY;
  const elRight = measure.pageX + measure.width;
  const elBottom = measure.pageY + measure.height;

  // screen bounds
  const scrLeft = 0;
  const scrTop = 0;
  const scrRight = screen.width;
  const scrBottom = screen.height;

  // intersection (visible rect)
  const visLeft = Math.max(elLeft, scrLeft);
  const visTop = Math.max(elTop, scrTop);
  const visRight = Math.min(elRight, scrRight);
  const visBottom = Math.min(elBottom, scrBottom);

  // no intersection — element is completely off-screen
  if (visLeft >= visRight || visTop >= visBottom) {
    return { cx, cy };
  }

  // center가 visible rect 밖이면 visible rect 중앙으로 보정
  const visCx = (visLeft + visRight) / 2;
  const visCy = (visTop + visBottom) / 2;

  const inX = cx >= visLeft && cx <= visRight;
  const inY = cy >= visTop && cy <= visBottom;

  return {
    cx: inX ? cx : visCx,
    cy: inY ? cy : visCy,
  };
}

/**
 * 좌표를 screen bounds(0~width, 0~height) 범위로 clamp.
 * swipe의 최종 x1/y1/x2/y2가 화면 밖으로 나가지 않도록 보정.
 */
export function clampCoord(x: number, y: number, screen: ScreenBounds): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, screen.width)),
    y: Math.max(0, Math.min(y, screen.height)),
  };
}
