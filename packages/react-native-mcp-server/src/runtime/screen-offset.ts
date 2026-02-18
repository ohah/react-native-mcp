// ─── Screen offset (no-op) ─────────────────────────────────────────
// Android에서의 measureInWindow → screen 절대좌표 보정은 이제 서버에서 수행.
// (ADB dumpsys window displays 파싱으로 정확한 top inset 감지)
// 런타임에서는 measureInWindow 좌표를 그대로 반환한다.
export var screenOffsetX = 0;
export var screenOffsetY = 0;

export function resolveScreenOffset(): void {
  // no-op: 보정 책임이 서버로 이동됨
}
