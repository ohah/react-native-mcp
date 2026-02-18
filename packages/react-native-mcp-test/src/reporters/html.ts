import { writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Reporter } from './index.js';
import type { StepResult, SuiteResult, RunResult } from '../types.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

export class HtmlReporter implements Reporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  onSuiteStart(_name: string): void {}
  onStepResult(_result: StepResult): void {}
  onSuiteEnd(_result: SuiteResult): void {}

  onRunEnd(result: RunResult): void {
    mkdirSync(this.outputDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const totalDur = formatDuration(result.duration);
    const statusClass = result.failed > 0 ? 'failed' : 'passed';

    const suiteRows: string[] = [];
    for (const suite of result.suites) {
      const suiteStatus = suite.status === 'passed' ? 'passed' : 'failed';
      const stepRows: string[] = [];
      for (const step of suite.steps) {
        const stepStatus = step.status;
        const err = step.error ? escapeHtml(step.error) : '';
        const screenshotRel = step.screenshotPath ? basename(step.screenshotPath) : '';
        const imgTag =
          screenshotRel &&
          `<p class="screenshot"><img src="${escapeHtml(screenshotRel)}" alt="Failure screenshot" loading="lazy" /></p>`;
        stepRows.push(`
        <tr class="step ${stepStatus}">
          <td class="step-name">${escapeHtml(stepLabel(step.step))}</td>
          <td class="step-status">${stepStatus}</td>
          <td class="step-duration">${formatDuration(step.duration)}</td>
          <td class="step-detail">${err}${imgTag ? imgTag : ''}</td>
        </tr>`);
      }
      suiteRows.push(`
      <section class="suite ${suiteStatus}">
        <h2 class="suite-name">${suite.status === 'passed' ? '✓' : '✗'} ${escapeHtml(suite.name)}</h2>
        <p class="suite-meta">${suite.steps.length} steps · ${formatDuration(suite.duration)}</p>
        <table class="steps">
          <thead><tr><th>Step</th><th>Status</th><th>Duration</th><th>Detail</th></tr></thead>
          <tbody>${stepRows.join('')}</tbody>
        </table>
      </section>`);
    }

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>E2E Test Report</title>
  <style>
    :root { --pass: #22c55e; --fail: #ef4444; --skip: #94a3b8; }
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 1.5rem; color: #1e293b; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .summary { font-size: 0.95rem; color: #64748b; margin-bottom: 1.5rem; }
    .summary.passed { color: var(--pass); }
    .summary.failed { color: var(--fail); }
    .suite { margin-bottom: 2rem; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .suite.passed { border-left: 4px solid var(--pass); }
    .suite.failed { border-left: 4px solid var(--fail); }
    .suite-name { margin: 0; padding: 0.75rem 1rem; font-size: 1.1rem; background: #f8fafc; }
    .suite-meta { margin: 0 1rem 0.5rem; font-size: 0.875rem; color: #64748b; }
    .steps { width: 100%; border-collapse: collapse; }
    .steps th, .steps td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid #f1f5f9; }
    .steps th { font-size: 0.75rem; text-transform: uppercase; color: #64748b; }
    .step-name { font-family: ui-monospace, monospace; font-size: 0.9rem; }
    .step-status.passed { color: var(--pass); }
    .step-status.failed { color: var(--fail); }
    .step-status.skipped { color: var(--skip); }
    .step-duration { color: #64748b; font-size: 0.875rem; }
    .step-detail { font-size: 0.875rem; color: #64748b; }
    .step-detail .screenshot { margin: 0.5rem 0 0; }
    .step-detail img { max-width: 320px; border: 1px solid #e2e8f0; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>E2E Test Report</h1>
  <p class="summary ${statusClass}">${date} · Total: ${result.suites.length} suite(s), ${result.total} step(s), ${result.failed} failed (${totalDur})</p>
  ${suiteRows.join('')}
</body>
</html>`;

    writeFileSync(join(this.outputDir, 'report.html'), html, 'utf-8');
  }
}
