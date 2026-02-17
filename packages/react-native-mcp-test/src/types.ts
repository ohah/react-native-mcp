import type { Platform } from '@ohah/react-native-mcp-client';

export interface TestConfig {
  platform: Platform;
  timeout?: number;
  bundleId?: string;
  deviceId?: string;
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
}
