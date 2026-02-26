import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppClient } from '../client/index.js';
import { parseFile } from './parser.js';
import type { Reporter } from './reporters/index.js';
import type {
  TestSuite,
  TestStep,
  StepResult,
  SuiteResult,
  RunResult,
  RunOptions,
} from './types.js';
import type { Platform } from '../client/types.js';

function stepKey(step: TestStep): string {
  return Object.keys(step)[0]!;
}

function resolveBundleId(
  bundleId: TestSuite['config']['bundleId'],
  platform: Platform
): string | undefined {
  if (bundleId == null) return undefined;
  if (typeof bundleId === 'string') return bundleId;
  return bundleId[platform];
}

interface StepContext {
  outputDir: string;
  /** create()에서 이미 실행한 bundleId와 같으면 launch 스텝을 건너뜀 (재시작으로 WebSocket 끊김 방지) */
  alreadyLaunchedBundleId?: string;
  /** create()에서 앱을 실행했으면 true (--no-auto-launch면 false) */
  didLaunchInCreate: boolean;
  /** config.bundleId를 플랫폼으로 해석한 값. launch: __bundleId__ 치환용 */
  resolvedBundleId?: string;
  /** hideKeyboard에서 iOS/Android 분기용 */
  platform: Platform;
  /** 현재 YAML 파일 경로. runFlow 상대경로 해석에 사용 */
  yamlFilePath?: string;
  /** runFlow 순환참조 방지용. 현재 포함 체인의 절대 경로 집합 */
  visitedFlows?: Set<string>;
  /** CLI --env로 전달된 환경 변수. runFlow에서 하위 파일 파싱 시 전달 */
  envVars?: Record<string, string>;
  /** setup 구간에서만 중복 launch 스킵. steps에서 terminate 후 launch는 항상 실행 */
  phase?: 'setup' | 'steps' | 'teardown';
}

async function executeStep(
  app: AppClient,
  step: TestStep,
  ctx: StepContext,
  opts?: { timeout?: number }
): Promise<void> {
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
      interval: step.waitForText.interval,
    });
    if (!result.pass) throw new Error(result.message);
  } else if ('waitForVisible' in step) {
    const result = await app.waitForVisible(step.waitForVisible.selector, {
      timeout: step.waitForVisible.timeout,
      interval: step.waitForVisible.interval,
    });
    if (!result.pass) throw new Error(result.message);
  } else if ('waitForNotVisible' in step) {
    const result = await app.waitForNotVisible(step.waitForNotVisible.selector, {
      timeout: step.waitForNotVisible.timeout,
      interval: step.waitForNotVisible.interval,
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
    const result = await app.assertElementCount(step.assertCount.selector, {
      expectedCount: step.assertCount.count,
      minCount: step.assertCount.minCount,
      maxCount: step.assertCount.maxCount,
    });
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
    const toLaunch =
      step.launch === '__bundleId__' ? (ctx.resolvedBundleId ?? step.launch) : step.launch;
    if (
      ctx.phase === 'setup' &&
      ctx.didLaunchInCreate &&
      alreadyLaunchedBundleId !== undefined &&
      toLaunch === alreadyLaunchedBundleId
    ) {
      return; // setup에서 이미 create()로 실행됨. 재실행 시 WebSocket 끊김 방지. steps에서 terminate 후 launch는 실행함.
    }
    await app.launch(toLaunch);
    // --no-auto-launch 모드에서 launch 후 앱 WebSocket 연결을 대기한다.
    // setup 내 launch 이후의 waitForVisible 등이 연결 전에 실행되는 것을 방지.
    if (!ctx.didLaunchInCreate) {
      await app.waitForConnection(opts?.timeout ?? 90_000, 2_000);
    }
  } else if ('terminate' in step) {
    const toTerminate =
      step.terminate === '__bundleId__' ? (ctx.resolvedBundleId ?? step.terminate) : step.terminate;
    await app.terminate(toTerminate);
  } else if ('openDeepLink' in step) {
    await app.openDeepLink(step.openDeepLink.url);
  } else if ('clearState' in step) {
    const appId =
      step.clearState === '__bundleId__'
        ? (ctx.resolvedBundleId ?? step.clearState)
        : step.clearState;
    await app.clearState(appId);
  } else if ('setLocation' in step) {
    await app.setLocation(step.setLocation.latitude, step.setLocation.longitude);
  } else if ('copyText' in step) {
    await app.copyText(step.copyText.selector);
  } else if ('pasteText' in step) {
    await app.pasteText();
  } else if ('evaluate' in step) {
    await app.evaluate(step.evaluate.script);
  } else if ('webviewEval' in step) {
    await app.webviewEval(step.webviewEval.webViewId, step.webviewEval.script);
  } else if ('scrollUntilVisible' in step) {
    const result = await app.scrollUntilVisible(step.scrollUntilVisible.selector, {
      scrollableSelector: step.scrollUntilVisible.scrollableSelector,
      direction: step.scrollUntilVisible.direction as 'up' | 'down' | 'left' | 'right' | undefined,
      maxScrolls: step.scrollUntilVisible.maxScrolls,
    });
    if (!result.pass) throw new Error(result.message);
  } else if ('back' in step) {
    await app.pressButton('BACK');
  } else if ('home' in step) {
    await app.pressButton('HOME');
  } else if ('hideKeyboard' in step) {
    if (ctx.platform === 'ios') {
      await app.inputKey(41); // HID Escape — dismisses keyboard on iOS simulator
    } else {
      await app.pressButton('BACK');
    }
  } else if ('longPress' in step) {
    await app.tap(step.longPress.selector, { duration: step.longPress.duration ?? 800 });
  } else if ('addMedia' in step) {
    await app.addMedia(step.addMedia.paths);
  } else if ('clearText' in step) {
    await app.clearText(step.clearText.selector);
  } else if ('doubleTap' in step) {
    await app.doubleTap(step.doubleTap.selector, { interval: step.doubleTap.interval });
  } else if ('assertValue' in step) {
    const result = await app.assertValue(step.assertValue.selector, step.assertValue.expected);
    if (!result.pass) throw new Error(result.message);
  } else if ('repeat' in step) {
    for (let i = 0; i < step.repeat.times; i++) {
      for (const s of step.repeat.steps) {
        await executeStep(app, s as TestStep, ctx, opts);
      }
    }
  } else if ('runFlow' in step) {
    if (!ctx.yamlFilePath) {
      throw new Error(
        'runFlow requires yamlFilePath in context (suite must be parsed from a file)'
      );
    }
    const flowPath = resolve(dirname(ctx.yamlFilePath), step.runFlow);
    const visited = ctx.visitedFlows ?? new Set<string>();
    if (visited.has(flowPath)) {
      throw new Error(`Circular runFlow reference: ${flowPath}`);
    }
    const flowSuite = parseFile(flowPath, ctx.envVars);
    const childCtx: StepContext = {
      ...ctx,
      yamlFilePath: flowPath,
      visitedFlows: new Set([...visited, flowPath]),
    };
    for (const s of flowSuite.steps) {
      await executeStep(app, s, childCtx, opts);
    }
  } else if ('if' in step) {
    let shouldRun = true;
    if (step.if.platform) {
      shouldRun = step.if.platform === ctx.platform;
    }
    if (step.if.visible && shouldRun) {
      const result = await app.assertVisible(step.if.visible);
      shouldRun = result.pass;
    }
    if (shouldRun) {
      for (const s of step.if.steps) {
        await executeStep(app, s as TestStep, ctx, opts);
      }
    }
  } else if ('mockNetwork' in step) {
    await app.setNetworkMock(step.mockNetwork);
  } else if ('clearNetworkMocks' in step) {
    await app.clearNetworkMocks();
  } else if ('retry' in step) {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= step.retry.times; attempt++) {
      try {
        for (const s of step.retry.steps) {
          await executeStep(app, s as TestStep, ctx, opts);
        }
        lastError = undefined;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < step.retry.times) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
    if (lastError) throw lastError;
  } else if ('compareScreenshot' in step) {
    const cs = step.compareScreenshot;
    // baseline 경로를 YAML 파일 기준 상대경로로 해석
    const baselinePath = ctx.yamlFilePath
      ? resolve(dirname(ctx.yamlFilePath), cs.baseline)
      : resolve(cs.baseline);
    const diffPath = cs.saveDiff
      ? cs.saveDiff.startsWith('/')
        ? resolve(cs.saveDiff)
        : resolve(ctx.outputDir, cs.saveDiff)
      : resolve(ctx.outputDir, `diff-${Date.now()}.png`);
    const saveCurrent = cs.saveCurrent
      ? cs.saveCurrent.startsWith('/')
        ? resolve(cs.saveCurrent)
        : resolve(ctx.outputDir, cs.saveCurrent)
      : undefined;
    const result = await app.visualCompare({
      baseline: baselinePath,
      selector: cs.selector,
      threshold: cs.threshold,
      updateBaseline: cs.update,
      saveDiff: cs.update ? undefined : diffPath,
      saveCurrent,
    });
    if (!result.pass && !cs.update) {
      const err = new Error(result.message) as Error & { diffImagePath?: string };
      err.diffImagePath = diffPath;
      throw err;
    }
  } else if ('startRecording' in step) {
    const filePath = step.startRecording.path
      ? step.startRecording.path.startsWith('/')
        ? resolve(step.startRecording.path)
        : resolve(ctx.outputDir, step.startRecording.path.replace(/^\.\//, ''))
      : resolve(ctx.outputDir, 'e2e-recording.mp4');
    mkdirSync(dirname(filePath), { recursive: true });
    await app.startRecording({ filePath });
  } else if ('stopRecording' in step) {
    await app.stopRecording();
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
  ctx: StepContext,
  stepOpts?: { timeout?: number }
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
      await executeStep(app, step, ctx, stepOpts);
      const result: StepResult = { step, status: 'passed', duration: Date.now() - start };
      results.push(result);
      reporter.onStepResult(result);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const failure = await captureFailure(app, suiteName, i, outputDir);
      const diffImagePath =
        err && typeof err === 'object' && 'diffImagePath' in err
          ? (err as { diffImagePath?: string }).diffImagePath
          : undefined;
      const result: StepResult = {
        step,
        status: 'failed',
        duration: Date.now() - start,
        error,
        screenshotPath: failure.screenshotPath,
        diffImagePath,
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
  opts: RunOptions = {},
  sharedApp?: AppClient
): Promise<SuiteResult> {
  const outputDir = opts.output ?? './results';
  const platform = opts.platform ?? suite.config.platform;
  const deviceId = opts.deviceId ?? suite.config.deviceId;
  const resolvedBundleId = resolveBundleId(suite.config.bundleId, platform);
  const start = Date.now();

  reporter.onSuiteStart(suite.name);

  const autoLaunch = opts.autoLaunch !== false;

  let app: AppClient;
  if (sharedApp) {
    app = sharedApp;
  } else {
    try {
      app = await AppClient.create({
        platform,
        deviceId,
        bundleId: resolvedBundleId,
        connectionTimeout: opts.timeout ?? suite.config.timeout,
        launchApp: autoLaunch,
        iosOrientation: suite.config.orientation,
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
  }

  const allStepResults: StepResult[] = [];
  let suiteFailed = false;

  const stepCtx: StepContext = {
    outputDir,
    alreadyLaunchedBundleId: resolvedBundleId,
    didLaunchInCreate: autoLaunch,
    resolvedBundleId,
    platform,
    yamlFilePath: suite.filePath,
    visitedFlows: suite.filePath ? new Set([suite.filePath]) : undefined,
    envVars: opts.envVars,
  };

  const connectionTimeout = opts.timeout ?? suite.config.timeout ?? 90_000;

  try {
    // setup
    if (suite.setup) {
      const { results, failed } = await runSteps(
        app,
        suite.setup,
        reporter,
        suite.name,
        {
          ...stepCtx,
          phase: 'setup',
        },
        {
          timeout: connectionTimeout,
        }
      );
      allStepResults.push(...results);
      if (failed) suiteFailed = true;
    }

    // steps (skip if setup failed)
    if (!suiteFailed) {
      const { results, failed } = await runSteps(
        app,
        suite.steps,
        reporter,
        suite.name,
        {
          ...stepCtx,
          phase: 'steps',
        },
        {
          timeout: connectionTimeout,
        }
      );
      allStepResults.push(...results);
      if (failed) suiteFailed = true;
    }
  } finally {
    // teardown always runs
    if (suite.teardown) {
      const { results } = await runSteps(
        app,
        suite.teardown,
        reporter,
        suite.name,
        {
          ...stepCtx,
          phase: 'teardown',
        },
        {
          timeout: connectionTimeout,
        }
      );
      allStepResults.push(...results);
    }

    if (!sharedApp) await app.close().catch(() => {});
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

/**
 * SuiteResult[]에서 스텝별 passed/failed/skipped 개수를 집계한다.
 * passed는 status === 'passed'만, skipped는 'skipped'만 카운트해
 * 한 스텝 실패 후 건너뛴 스텝이 passed로 잡히지 않도록 한다.
 */
export function aggregateStepCounts(suiteResults: SuiteResult[]): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
} {
  const total = suiteResults.reduce((sum, s) => sum + s.steps.length, 0);
  const passed = suiteResults.reduce(
    (sum, s) => sum + s.steps.filter((st) => st.status === 'passed').length,
    0
  );
  const failed = suiteResults.reduce(
    (sum, s) => sum + s.steps.filter((st) => st.status === 'failed').length,
    0
  );
  const skipped = suiteResults.reduce(
    (sum, s) => sum + s.steps.filter((st) => st.status === 'skipped').length,
    0
  );
  return { total, passed, failed, skipped };
}

export async function runAll(
  suites: TestSuite[],
  reporter: Reporter,
  opts: RunOptions = {}
): Promise<RunResult> {
  const start = Date.now();
  const suiteResults: SuiteResult[] = [];

  if (suites.length === 0) {
    const result: RunResult = {
      suites: [],
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: Date.now() - start,
    };
    const end = reporter.onRunEnd(result);
    if (end instanceof Promise) await end;
    return result;
  }

  const first = suites[0]!;
  const platform = opts.platform ?? first.config.platform;
  const deviceId = opts.deviceId ?? first.config.deviceId;
  const resolvedBundleId = resolveBundleId(first.config.bundleId, platform);
  const autoLaunch = opts.autoLaunch !== false;

  let app: AppClient | null = null;
  try {
    app = await AppClient.create({
      platform,
      deviceId,
      bundleId: resolvedBundleId,
      connectionTimeout: opts.timeout ?? first.config.timeout,
      launchApp: autoLaunch,
      iosOrientation: first.config.orientation,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const failedResult: SuiteResult = {
      name: first.name,
      status: 'failed',
      duration: 0,
      steps: [
        {
          step: { launch: 'AppClient.create' } as TestStep,
          status: 'failed',
          duration: 0,
          error,
        },
      ],
    };
    reporter.onSuiteStart(first.name);
    reporter.onStepResult(failedResult.steps[0]!);
    reporter.onSuiteEnd(failedResult);
    const result: RunResult = {
      suites: [failedResult],
      total: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: Date.now() - start,
    };
    const end = reporter.onRunEnd(result);
    if (end instanceof Promise) await end;
    return result;
  }

  const bail = opts.bail !== false; // default: true
  try {
    for (const suite of suites) {
      const result = await runSuite(suite, reporter, opts, app);
      suiteResults.push(result);
      if (bail && result.status === 'failed') break;
    }
  } finally {
    await app.close().catch(() => {});
  }

  const counts = aggregateStepCounts(suiteResults);
  const result: RunResult = {
    suites: suiteResults,
    total: counts.total,
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    duration: Date.now() - start,
  };

  const end = reporter.onRunEnd(result);
  if (end instanceof Promise) await end;
  return result;
}
