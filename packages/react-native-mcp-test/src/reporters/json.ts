import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Reporter } from './index.js';
import type { StepResult, SuiteResult, RunResult } from '../types.js';

export class JsonReporter implements Reporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  onSuiteStart(_name: string): void {}
  onStepResult(_result: StepResult): void {}
  onSuiteEnd(_result: SuiteResult): void {}

  onRunEnd(result: RunResult): void {
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(join(this.outputDir, 'results.json'), JSON.stringify(result, null, 2), 'utf-8');
  }
}
