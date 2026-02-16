import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Reporter } from './index.js';
import type { StepResult, SuiteResult, RunResult } from '../types.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stepName(step: StepResult['step']): string {
  const key = Object.keys(step)[0]!;
  const val = (step as Record<string, unknown>)[key];
  if (typeof val === 'string' || typeof val === 'number') return `${key}: ${val}`;
  if (typeof val === 'object' && val !== null) {
    const inner = val as Record<string, unknown>;
    return `${key}: ${Object.values(inner).join(', ')}`;
  }
  return key;
}

export class JUnitReporter implements Reporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  onSuiteStart(_name: string): void {}
  onStepResult(_result: StepResult): void {}
  onSuiteEnd(_result: SuiteResult): void {}

  onRunEnd(result: RunResult): void {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push(
      `<testsuites tests="${result.total}" failures="${result.failed}" time="${(result.duration / 1000).toFixed(3)}">`
    );

    for (const suite of result.suites) {
      const failures = suite.steps.filter((s) => s.status === 'failed').length;
      lines.push(
        `  <testsuite name="${escapeXml(suite.name)}" tests="${suite.steps.length}" failures="${failures}" time="${(suite.duration / 1000).toFixed(3)}">`
      );

      for (const step of suite.steps) {
        const name = escapeXml(stepName(step.step));
        lines.push(`    <testcase name="${name}" time="${(step.duration / 1000).toFixed(3)}">`);
        if (step.status === 'failed' && step.error) {
          lines.push(
            `      <failure message="${escapeXml(step.error)}">${escapeXml(step.error)}</failure>`
          );
        }
        if (step.status === 'skipped') {
          lines.push('      <skipped/>');
        }
        lines.push('    </testcase>');
      }

      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');

    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(join(this.outputDir, 'junit.xml'), lines.join('\n'), 'utf-8');
  }
}
