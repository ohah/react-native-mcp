import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppClient } from '@ohah/react-native-mcp-client';
import type { Reporter } from './reporters/index.js';
import type {
  TestSuite,
  TestStep,
  StepResult,
  SuiteResult,
  RunResult,
  RunOptions,
} from './types.js';

function stepKey(step: TestStep): string {
  return Object.keys(step)[0]!;
}

interface StepContext {
  outputDir: string;
  /** create()에서 이미 실행한 bundleId와 같으면 launch 스텝을 건너뜀 (재시작으로 WebSocket 끊김 방지) */
  alreadyLaunchedBundleId?: string;
}

async function executeStep(app: AppClient, step: TestStep, ctx: StepContext): Promise<void> {
  const { alreadyLaunchedBundleId } = ctx;
  if ('tap' in step) {
    await app.tap(step.tap.selector, { duration: step.tap.duration });
  } else if ('swipe' in step) {
    await app.swipe(step.swipe.selector, {
      direction: step.swipe.direction as 'up' | 'down' | 'left' | 'right',
      distance: step.swipe.distance,
      duration: step.swipe.duration,
    });
  } else if ('typeText' in step) {
    await app.typeText(step.typeText.selector, step.typeText.text);
  } else if ('inputText' in step) {
    await app.inputText(step.inputText.text);
  } else if ('pressButton' in step) {
    await app.pressButton(step.pressButton.button);
  } else if ('waitForText' in step) {
    const result = await app.waitForText(step.waitForText.text, {
      timeout: step.waitForText.timeout,
      selector: step.waitForText.selector,
    });
    if (!result.pass) throw new Error(result.message);
  } else if ('waitForVisible' in step) {
    const result = await app.waitForVisible(step.waitForVisible.selector, {
      timeout: step.waitForVisible.timeout,
    });
    if (!result.pass) throw new Error(result.message);
  } else if ('waitForNotVisible' in step) {
    const result = await app.waitForNotVisible(step.waitForNotVisible.selector, {
      timeout: step.waitForNotVisible.timeout,
    });
    if (!result.pass) throw new Error(result.message);
  } else if ('assertText' in step) {
    const result = await app.assertText(step.assertText.text, {
      selector: step.assertText.selector,
    });
    if (!result.pass) throw new Error(result.message);
  } else if ('assertVisible' in step) {
    const result = await app.assertVisible(step.assertVisible.selector);
    if (!result.pass) throw new Error(result.message);
  } else if ('assertNotVisible' in step) {
    const result = await app.assertNotVisible(step.assertNotVisible.selector);
    if (!result.pass) throw new Error(result.message);
  } else if ('assertCount' in step) {
    const result = await app.assertCount(step.assertCount.selector, step.assertCount.count);
    if (!result.pass) throw new Error(result.message);
  } else if ('screenshot' in step) {
    const filePath = step.screenshot.path
      ? step.screenshot.path.startsWith('/')
        ? resolve(step.screenshot.path)
        : resolve(ctx.outputDir, step.screenshot.path.replace(/^\.\//, ''))
      : undefined;
    if (filePath) mkdirSync(dirname(filePath), { recursive: true });
    await app.screenshot({ filePath });
  } else if ('wait' in step) {
    await new Promise((resolve) => setTimeout(resolve, step.wait));
  } else if ('launch' in step) {
    if (alreadyLaunchedBundleId !== undefined && step.launch === alreadyLaunchedBundleId) {
      return; // 이미 create()에서 실행됨. 재실행 시 앱 재시작 → WebSocket 끊김 → 이후 스텝 실패 방지
    }
    await app.launch(step.launch);
  } else if ('terminate' in step) {
    await app.terminate(step.terminate);
  } else if ('openDeepLink' in step) {
    await app.openDeepLink(step.openDeepLink.url);
  } else if ('evaluate' in step) {
    await app.evaluate(step.evaluate.script);
  } else if ('webviewEval' in step) {
    await app.webviewEval(step.webviewEval.webViewId, step.webviewEval.script);
  } else if ('scrollUntilVisible' in step) {
    const result = await app.scrollUntilVisible(step.scrollUntilVisible.selector, {
      direction: step.scrollUntilVisible.direction as 'up' | 'down' | 'left' | 'right' | undefined,
      maxScrolls: step.scrollUntilVisible.maxScrolls,
    });
    if (!result.pass) throw new Error(result.message);
  } else {
    throw new Error(`Unknown step type: ${stepKey(step as TestStep)}`);
  }
}

async function captureFailure(
  app: AppClient,
  suiteName: string,
  stepIndex: number,
  outputDir: string
): Promise<{ screenshotPath?: string; snapshotPath?: string }> {
  const result: { screenshotPath?: string; snapshotPath?: string } = {};
  mkdirSync(outputDir, { recursive: true });

  try {
    const screenshotPath = resolve(outputDir, `${suiteName}-step${stepIndex}-failure.png`);
    await app.screenshot({ filePath: screenshotPath });
    result.screenshotPath = screenshotPath;
  } catch {
    // screenshot capture failed, continue
  }

  return result;
}

async function runSteps(
  app: AppClient,
  steps: TestStep[],
  reporter: Reporter,
  suiteName: string,
  ctx: StepContext
): Promise<{ results: StepResult[]; failed: boolean }> {
  const results: StepResult[] = [];
  let failed = false;
  const { outputDir } = ctx;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const start = Date.now();

    if (failed) {
      results.push({ step, status: 'skipped', duration: 0 });
      reporter.onStepResult(results[results.length - 1]!);
      continue;
    }

    try {
      await executeStep(app, step, ctx);
      const result: StepResult = { step, status: 'passed', duration: Date.now() - start };
      results.push(result);
      reporter.onStepResult(result);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const failure = await captureFailure(app, suiteName, i, outputDir);
      const result: StepResult = {
        step,
        status: 'failed',
        duration: Date.now() - start,
        error,
        screenshotPath: failure.screenshotPath,
      };
      results.push(result);
      reporter.onStepResult(result);
      failed = true;
    }
  }

  return { results, failed };
}

export async function runSuite(
  suite: TestSuite,
  reporter: Reporter,
  opts: RunOptions = {}
): Promise<SuiteResult> {
  const outputDir = opts.output ?? './results';
  const platform = opts.platform ?? suite.config.platform;
  const deviceId = opts.deviceId ?? suite.config.deviceId;
  const start = Date.now();

  reporter.onSuiteStart(suite.name);

  let app: AppClient;
  try {
    app = await AppClient.create({
      platform,
      deviceId,
      bundleId: suite.config.bundleId,
      connectionTimeout: opts.timeout ?? suite.config.timeout,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const result: SuiteResult = {
      name: suite.name,
      status: 'failed',
      duration: Date.now() - start,
      steps: [
        {
          step: { launch: 'AppClient.create' } as TestStep,
          status: 'failed',
          duration: Date.now() - start,
          error,
        },
      ],
    };
    reporter.onStepResult(result.steps[0]!);
    reporter.onSuiteEnd(result);
    return result;
  }

  const allStepResults: StepResult[] = [];
  let suiteFailed = false;

  const stepCtx: StepContext = {
    outputDir,
    alreadyLaunchedBundleId: suite.config.bundleId,
  };

  try {
    // setup
    if (suite.setup) {
      const { results, failed } = await runSteps(app, suite.setup, reporter, suite.name, stepCtx);
      allStepResults.push(...results);
      if (failed) suiteFailed = true;
    }

    // steps (skip if setup failed)
    if (!suiteFailed) {
      const { results, failed } = await runSteps(app, suite.steps, reporter, suite.name, stepCtx);
      allStepResults.push(...results);
      if (failed) suiteFailed = true;
    }
  } finally {
    // teardown always runs
    if (suite.teardown) {
      const { results } = await runSteps(app, suite.teardown, reporter, suite.name, stepCtx);
      allStepResults.push(...results);
    }

    await app.close().catch(() => {});
  }

  const result: SuiteResult = {
    name: suite.name,
    status: suiteFailed ? 'failed' : 'passed',
    duration: Date.now() - start,
    steps: allStepResults,
  };

  reporter.onSuiteEnd(result);
  return result;
}

export async function runAll(
  suites: TestSuite[],
  reporter: Reporter,
  opts: RunOptions = {}
): Promise<RunResult> {
  const start = Date.now();
  const suiteResults: SuiteResult[] = [];

  const bail = opts.bail !== false; // default: true
  for (const suite of suites) {
    const result = await runSuite(suite, reporter, opts);
    suiteResults.push(result);
    if (bail && result.status === 'failed') break;
  }

  const totalSteps = suiteResults.reduce((sum, s) => sum + s.steps.length, 0);
  const failedSteps = suiteResults.reduce(
    (sum, s) => sum + s.steps.filter((st) => st.status === 'failed').length,
    0
  );

  const result: RunResult = {
    suites: suiteResults,
    total: totalSteps,
    passed: totalSteps - failedSteps,
    failed: failedSteps,
    duration: Date.now() - start,
  };

  reporter.onRunEnd(result);
  return result;
}
