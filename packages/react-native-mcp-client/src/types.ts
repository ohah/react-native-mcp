export type Platform = 'ios' | 'android';

export interface CreateAppOptions {
  platform: Platform;
  deviceId?: string;
  /** 앱 번들 ID — 지정 시 서버 시작 후 자동 launch */
  bundleId?: string;
  /** MCP 서버 실행 명령 (default: 'bun') */
  serverCommand?: string;
  /** MCP 서버 인자 (default: ['dist/index.js']) */
  serverArgs?: string[];
  /** MCP 서버 CWD (default: 자동 감지) */
  serverCwd?: string;
  /** 앱 연결 대기 타임아웃 ms (default: 90_000) */
  connectionTimeout?: number;
  /** 앱 연결 대기 폴링 간격 ms (default: 2_000) */
  connectionInterval?: number;
  /** bundleId가 있어도 create()에서 앱 자동 실행 안 함. YAML setup의 launch 스텝으로 실행할 때 true (default: true = 자동 실행) */
  launchApp?: boolean;
  /** iOS GraphicsOrientation 강제값 (1-4). 지정 시 xcrun 자동감지를 건너뛰고 이 값으로 좌표 변환. e2e.yaml config.orientation에서 전달됨. */
  iosOrientation?: number;
}

export interface DeviceOpts {
  deviceId?: string;
  platform?: Platform;
}

export interface AssertOpts extends DeviceOpts {
  timeoutMs?: number;
  intervalMs?: number;
}

export interface AssertResult {
  pass: boolean;
  message: string;
}

export interface AssertCountResult extends AssertResult {
  actualCount: number;
}

export interface ElementMeasure {
  x: number;
  y: number;
  width: number;
  height: number;
  pageX: number;
  pageY: number;
}

export interface ElementInfo {
  uid: string;
  type: string;
  testID?: string;
  text?: string;
  accessibilityLabel?: string;
  measure?: ElementMeasure;
  value?: string;
  disabled?: boolean;
  editable?: boolean;
  [key: string]: unknown;
}

export interface ScrollUntilVisibleResult {
  pass: boolean;
  scrollCount: number;
  element?: ElementInfo;
  message: string;
}

export interface DebuggerStatus {
  appConnected: boolean;
  devices: Array<{
    deviceId: string;
    platform: Platform;
    deviceName?: string;
  }>;
}

export interface WaitOpts extends DeviceOpts {
  timeout?: number;
  interval?: number;
}
