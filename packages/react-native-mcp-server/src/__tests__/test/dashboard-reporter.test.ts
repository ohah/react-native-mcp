import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  runResultToSummary,
  computeFlaky,
  buildIndexHtml,
  DashboardReporter,
  type DashboardRunSummary,
} from '../../test/reporters/dashboard.js';
import { createReporter } from '../../test/reporters/index.js';
import type { RunResult, SuiteResult, StepResult } from '../../test/types.js';

function stepResult(
  status: StepResult['status'],
  step: StepResult['step'] = { wait: 0 }
): StepResult {
  return { step, status, duration: 0 };
}

function runResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    suites: [
      {
        name: 'Suite1',
        status: 'passed',
        duration: 100,
        steps: [
          stepResult('passed', { tap: { selector: '#btn' } }),
          stepResult('failed', { assertText: { text: 'Hello' } }),
        ],
      },
    ],
    total: 2,
    passed: 1,
    failed: 1,
    skipped: 0,
    duration: 150,
    ...overrides,
  };
}

describe('runResultToSummary', () => {
  it('RunResult를 DashboardRunSummary로 변환하고 step label 생성', () => {
    const result = runResult();
    const summary = runResultToSummary(result, 'run-1', 'ios');
    expect(summary.runId).toBe('run-1');
    expect(summary.timestamp).toBeGreaterThan(0);
    expect(summary.duration).toBe(150);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.platform).toBe('ios');
    expect(summary.suites).toHaveLength(1);
    expect(summary.suites[0].name).toBe('Suite1');
    expect(summary.suites[0].steps).toHaveLength(2);
    expect(summary.suites[0].steps[0].label).toContain('tap');
    expect(summary.suites[0].steps[0].status).toBe('passed');
    expect(summary.suites[0].steps[1].label).toContain('assertText');
    expect(summary.suites[0].steps[1].status).toBe('failed');
  });

  it('platform 없이 호출 시 summary.platform은 undefined', () => {
    const summary = runResultToSummary(runResult(), 'id');
    expect(summary.platform).toBeUndefined();
  });

  it('스텝에 error와 duration이 있으면 summary에 포함', () => {
    const result = runResult({
      suites: [
        {
          name: 'S',
          status: 'failed',
          duration: 50,
          steps: [{ step: { wait: 0 }, status: 'failed', duration: 10, error: 'Timeout 5000ms' }],
        },
      ],
    });
    const summary = runResultToSummary(result, 'id');
    expect(summary.suites[0].steps[0].duration).toBe(10);
    expect(summary.suites[0].steps[0].error).toBe('Timeout 5000ms');
  });

  it('각 스텝에 stepPayload(JSON 문자열) 포함', () => {
    const result = runResult();
    const summary = runResultToSummary(result, 'id');
    expect(summary.suites[0].steps[0].stepPayload).toBeDefined();
    expect(JSON.parse(summary.suites[0].steps[0].stepPayload!)).toEqual({
      tap: { selector: '#btn' },
    });
    expect(summary.suites[0].steps[1].stepPayload).toBeDefined();
    expect(JSON.parse(summary.suites[0].steps[1].stepPayload!)).toEqual({
      assertText: { text: 'Hello' },
    });
  });
});

describe('buildIndexHtml', () => {
  it('생성 HTML에 run 펼침·스텝 Detail·runs.json fetch·toggleStepDetail 포함', () => {
    const html = buildIndexHtml();
    expect(html).toContain('run-detail');
    expect(html).toContain("fetch('./runs.json')");
    expect(html).toContain('toggleStepDetail');
    expect(html).toContain('>Detail</span>');
    expect(html).toContain('E2E Dashboard');
    expect(html).toContain('Loading...');
  });
});

describe('computeFlaky', () => {
  it('빈 배열이면 flaky 없음', () => {
    expect(computeFlaky([])).toEqual([]);
  });

  it('한 런만 있으면 flaky 없음', () => {
    const runs: DashboardRunSummary[] = [
      {
        runId: '1',
        timestamp: 1,
        duration: 0,
        passed: 1,
        failed: 1,
        skipped: 0,
        suites: [
          {
            name: 'S',
            status: 'failed',
            steps: [
              { label: 'tap #btn', status: 'passed', duration: 0 },
              { label: 'assertText', status: 'failed', duration: 0 },
            ],
          },
        ],
      },
    ];
    expect(computeFlaky(runs)).toEqual([]);
  });

  it('같은 스텝이 어떤 런에서는 pass, 어떤 런에서는 fail이면 flaky', () => {
    const runs: DashboardRunSummary[] = [
      {
        runId: '1',
        timestamp: 1,
        duration: 0,
        passed: 1,
        failed: 0,
        skipped: 0,
        suites: [
          {
            name: 'S',
            status: 'passed',
            steps: [{ label: 'tap #x', status: 'passed', duration: 0 }],
          },
        ],
      },
      {
        runId: '2',
        timestamp: 2,
        duration: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        suites: [
          {
            name: 'S',
            status: 'failed',
            steps: [{ label: 'tap #x', status: 'failed', duration: 0 }],
          },
        ],
      },
    ];
    const flaky = computeFlaky(runs);
    expect(flaky).toHaveLength(1);
    expect(flaky[0].suite).toBe('S');
    expect(flaky[0].step).toBe('tap #x');
    expect(flaky[0].passCount).toBe(1);
    expect(flaky[0].failCount).toBe(1);
  });

  it('windowSize 적용 시 최근 N회만 사용', () => {
    const runs: DashboardRunSummary[] = [];
    for (let i = 0; i < 25; i++) {
      runs.push({
        runId: String(i),
        timestamp: i,
        duration: 0,
        passed: i < 15 ? 1 : 0,
        failed: i >= 15 ? 1 : 0,
        skipped: 0,
        suites: [
          {
            name: 'S',
            status: i < 15 ? 'passed' : 'failed',
            steps: [{ label: 'step', status: i < 15 ? 'passed' : 'failed', duration: 0 }],
          },
        ],
      });
    }
    const flaky = computeFlaky(runs, 20);
    expect(flaky).toHaveLength(1);
    expect(flaky[0].passCount).toBe(10);
    expect(flaky[0].failCount).toBe(10);
  });
});

describe('DashboardReporter', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `dashboard-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmp)) rmSync(tmp, { recursive: true });
  });

  it('onRunEnd 시 dashboard/runs.json 생성하고 한 요소 추가', () => {
    const reporter = new DashboardReporter(tmp);
    reporter.onRunEnd(runResult());
    const runsPath = join(tmp, 'dashboard', 'runs.json');
    expect(existsSync(runsPath)).toBe(true);
    const runs = JSON.parse(readFileSync(runsPath, 'utf-8')) as DashboardRunSummary[];
    expect(runs).toHaveLength(1);
    expect(runs[0].runId).toBeDefined();
    expect(runs[0].suites[0].steps[0].label).toContain('tap');
  });

  it('기존 runs.json 있으면 append 후 slice(-100) 적용', () => {
    const reporter = new DashboardReporter(tmp);
    reporter.onRunEnd(runResult());
    reporter.onRunEnd(runResult());
    const runsPath = join(tmp, 'dashboard', 'runs.json');
    const runs = JSON.parse(readFileSync(runsPath, 'utf-8')) as DashboardRunSummary[];
    expect(runs).toHaveLength(2);
  });

  it('101번 실행 시 100개만 유지', () => {
    const reporter = new DashboardReporter(tmp);
    for (let i = 0; i < 101; i++) {
      reporter.onRunEnd(runResult({ duration: i }));
    }
    const runsPath = join(tmp, 'dashboard', 'runs.json');
    const runs = JSON.parse(readFileSync(runsPath, 'utf-8')) as DashboardRunSummary[];
    expect(runs).toHaveLength(100);
    expect(runs[0].duration).toBe(1);
    expect(runs[99].duration).toBe(100);
  });

  it('onRunEnd 시 dashboard/index.html 생성', () => {
    const reporter = new DashboardReporter(tmp);
    reporter.onRunEnd(runResult());
    const htmlPath = join(tmp, 'dashboard', 'index.html');
    expect(existsSync(htmlPath)).toBe(true);
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('runs.json');
    expect(html).toContain('E2E Dashboard');
    expect(html).toContain('Flaky');
  });

  it('platform 전달 시 summary에 반영', () => {
    const reporter = new DashboardReporter(tmp, 'android');
    reporter.onRunEnd(runResult());
    const runs = JSON.parse(
      readFileSync(join(tmp, 'dashboard', 'runs.json'), 'utf-8')
    ) as DashboardRunSummary[];
    expect(runs[0].platform).toBe('android');
  });
});

describe('createReporter(dashboard)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(
      tmpdir(),
      `dashboard-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmp)) rmSync(tmp, { recursive: true });
  });

  it('dashboard 타입 시 DashboardReporter 인스턴스 반환하고 onRunEnd 시 runs.json 생성', () => {
    const reporter = createReporter('dashboard', tmp);
    expect(reporter).toBeInstanceOf(DashboardReporter);
    expect(typeof reporter.onRunEnd).toBe('function');
    reporter.onRunEnd(runResult());
    expect(existsSync(join(tmp, 'dashboard', 'runs.json'))).toBe(true);
  });
});
