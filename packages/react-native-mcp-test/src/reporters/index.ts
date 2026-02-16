import type { StepResult, SuiteResult, RunResult } from '../types.js';
import { ConsoleReporter } from './console.js';
import { JUnitReporter } from './junit.js';
import { JsonReporter } from './json.js';

export interface Reporter {
  onSuiteStart(name: string): void;
  onStepResult(result: StepResult): void;
  onSuiteEnd(result: SuiteResult): void;
  onRunEnd(result: RunResult): void;
}

export function createReporter(type: string, outputDir: string): Reporter {
  switch (type) {
    case 'junit':
      return new JUnitReporter(outputDir);
    case 'json':
      return new JsonReporter(outputDir);
    case 'console':
    default:
      return new ConsoleReporter();
  }
}

export { ConsoleReporter } from './console.js';
export { JUnitReporter } from './junit.js';
export { JsonReporter } from './json.js';
