import { describe, expect, it } from 'bun:test';
import { aggregateStepCounts } from '../../test/runner.js';
import type { SuiteResult, StepResult } from '../../test/types.js';

function stepResult(
  status: StepResult['status'],
  step: StepResult['step'] = { wait: 0 }
): StepResult {
  return { step, status, duration: 0 };
}

describe('aggregateStepCounts', () => {
  it('전부 passed면 passed=total, failed=0, skipped=0', () => {
    const suites: SuiteResult[] = [
      {
        name: 'A',
        status: 'passed',
        duration: 0,
        steps: [stepResult('passed'), stepResult('passed')],
      },
    ];
    const counts = aggregateStepCounts(suites);
    expect(counts.total).toBe(2);
    expect(counts.passed).toBe(2);
    expect(counts.failed).toBe(0);
    expect(counts.skipped).toBe(0);
  });

  it('한 스텝 실패 후 나머지 skipped인 경우 passed는 실제 성공만, skipped 별도 집계', () => {
    const suites: SuiteResult[] = [
      {
        name: 'Suite',
        status: 'failed',
        duration: 0,
        steps: [
          stepResult('passed'),
          stepResult('failed'),
          stepResult('skipped'),
          stepResult('skipped'),
        ],
      },
    ];
    const counts = aggregateStepCounts(suites);
    expect(counts.total).toBe(4);
    expect(counts.passed).toBe(1);
    expect(counts.failed).toBe(1);
    expect(counts.skipped).toBe(2);
    expect(counts.passed + counts.failed + counts.skipped).toBe(counts.total);
  });

  it('실패만 있으면 passed=0, failed=total', () => {
    const suites: SuiteResult[] = [
      {
        name: 'S',
        status: 'failed',
        duration: 0,
        steps: [stepResult('failed')],
      },
    ];
    const counts = aggregateStepCounts(suites);
    expect(counts.passed).toBe(0);
    expect(counts.failed).toBe(1);
    expect(counts.skipped).toBe(0);
  });

  it('여러 스위트 합산 시 passed/failed/skipped 각각 정확히 합산', () => {
    const suites: SuiteResult[] = [
      {
        name: 'S1',
        status: 'failed',
        duration: 0,
        steps: [stepResult('passed'), stepResult('failed'), stepResult('skipped')],
      },
      {
        name: 'S2',
        status: 'passed',
        duration: 0,
        steps: [stepResult('passed'), stepResult('passed')],
      },
    ];
    const counts = aggregateStepCounts(suites);
    expect(counts.total).toBe(5);
    expect(counts.passed).toBe(3);
    expect(counts.failed).toBe(1);
    expect(counts.skipped).toBe(1);
  });
});
