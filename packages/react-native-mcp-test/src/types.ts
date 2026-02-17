import type { Platform } from '@ohah/react-native-mcp-client';

export interface TestConfig {
  platform: Platform;
  timeout?: number;
  /** 단일 문자열이면 공통, 객체면 플랫폼별. CLI -p로 덮을 때 사용 */
  bundleId?: string | { ios: string; android: string };
  deviceId?: string;
  /** iOS GraphicsOrientation 강제값 (1-4). 1=Portrait, 2=Portrait180, 3=LandscapeA, 4=LandscapeB. 지정 시 xcrun 자동감지 건너뜀. */
  orientation?: number;
}

export interface TestSuite {
  name: string;
  config: TestConfig;
  setup?: TestStep[];
  steps: TestStep[];
  teardown?: TestStep[];
}

export type TestStep =
  | { tap: { selector: string; duration?: number } }
  | { swipe: { selector: string; direction: string; distance?: number; duration?: number } }
  | { typeText: { selector: string; text: string } }
  | { inputText: { text: string } }
  | { pressButton: { button: string } }
  | { waitForText: { text: string; timeout?: number; selector?: string } }
  | { waitForVisible: { selector: string; timeout?: number } }
  | { waitForNotVisible: { selector: string; timeout?: number } }
  | { assertText: { text: string; selector?: string } }
  | { assertVisible: { selector: string } }
  | { assertNotVisible: { selector: string } }
  | { assertCount: { selector: string; count: number } }
  | { screenshot: { path?: string } }
  | { wait: number }
  | { launch: string }
  | { terminate: string }
  | { openDeepLink: { url: string } }
  | { evaluate: { script: string } }
  | { webviewEval: { webViewId: string; script: string } }
  | { scrollUntilVisible: { selector: string; direction?: string; maxScrolls?: number } };

export interface StepResult {
  step: TestStep;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshotPath?: string;
}

export interface SuiteResult {
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  steps: StepResult[];
  snapshotPath?: string;
}

export interface RunResult {
  suites: SuiteResult[];
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

export interface RunOptions {
  platform?: Platform;
  reporter?: string;
  output?: string;
  timeout?: number;
  deviceId?: string;
  bail?: boolean;
  /** false면 create()에서 앱 자동 실행 안 함. 워크플로에서 설치만 하고 setup의 launch로 실행할 때 사용 (default: true) */
  autoLaunch?: boolean;
}
