import type { Reporter } from './index.js';
import type { StepResult, SuiteResult, RunResult } from '../types.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function stepLabel(step: StepResult['step']): string {
  const key = Object.keys(step)[0]!;
  const val = (step as Record<string, unknown>)[key];
  if (typeof val === 'string' || typeof val === 'number') {
    return `${key} ${val}`;
  }
  if (typeof val === 'object' && val !== null) {
    const inner = val as Record<string, unknown>;
    const parts = Object.entries(inner)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(' ');
    return `${key} ${parts}`;
  }
  return key;
}

export class ConsoleReporter implements Reporter {
  onSuiteStart(name: string): void {
    console.log(`\n  ${name}`);
  }

  onStepResult(result: StepResult): void {
    const icon = result.status === 'passed' ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const dur = `${DIM}(${formatDuration(result.duration)})${RESET}`;
    console.log(`    ${icon} ${stepLabel(result.step)} ${dur}`);

    if (result.error) {
      console.log(`      ${RED}${result.error}${RESET}`);
    }
    if (result.screenshotPath) {
      console.log(`      📸 ${result.screenshotPath}`);
    }
  }

  onSuiteEnd(result: SuiteResult): void {
    const icon = result.status === 'passed' ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${result.name} ${DIM}(${formatDuration(result.duration)})${RESET}`);
  }

  onRunEnd(result: RunResult): void {
    console.log('');
    const passedStr = result.passed > 0 ? `${GREEN}${result.passed} passed${RESET}` : '0 passed';
    const failedStr = result.failed > 0 ? `${RED}${result.failed} failed${RESET}` : '0 failed';
    console.log(
      `  Results: ${passedStr}, ${failedStr} ${DIM}(${formatDuration(result.duration)})${RESET}`
    );
    console.log('');
  }
}
