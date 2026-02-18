import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import type { Reporter } from './index.js';
import type { StepResult, SuiteResult, RunResult } from '../types.js';

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

export interface GithubPrReporterOptions {
  /** 출력 디렉터리. PR 코멘트 본문을 pr-comment.md로 저장할 때 사용 (PR 미검출 시) */
  outputDir: string;
}

/**
 * GitHub Actions 등에서 GITHUB_REF가 refs/pull/<number>/merge 형태일 때
 * PR 번호를 반환한다. 아니면 undefined.
 */
function getPrNumberFromEnv(): number | undefined {
  const ref = process.env.GITHUB_REF;
  if (!ref || !ref.startsWith('refs/pull/')) return undefined;
  const match = ref.match(/^refs\/pull\/(\d+)\//);
  const group = match?.[1];
  return group ? parseInt(group, 10) : undefined;
}

export class GithubPrReporter implements Reporter {
  private outputDir: string;

  constructor(options: GithubPrReporterOptions) {
    this.outputDir = options.outputDir;
  }

  onSuiteStart(_name: string): void {}
  onStepResult(_result: StepResult): void {}
  onSuiteEnd(_result: SuiteResult): void {}

  onRunEnd(result: RunResult): void {
    const body = this.buildMarkdown(result);
    const prNumber = getPrNumberFromEnv();

    if (prNumber != null) {
      try {
        const tmpFile = join(tmpdir(), `rn-mcp-test-pr-${Date.now()}.md`);
        writeFileSync(tmpFile, body, 'utf-8');
        execSync(`gh pr comment ${prNumber} --body-file "${tmpFile}"`, {
          stdio: 'inherit',
          encoding: 'utf-8',
        });
        try {
          unlinkSync(tmpFile);
        } catch {
          // ignore
        }
      } catch (err) {
        console.error(
          'GitHub PR reporter failed (is `gh` installed and authenticated?):',
          err instanceof Error ? err.message : err
        );
        this.writeFallback(body);
      }
    } else {
      this.writeFallback(body);
    }
  }

  private buildMarkdown(result: RunResult): string {
    const totalDur = formatDuration(result.duration);
    const status = result.failed > 0 ? '❌ Failed' : '✅ Passed';
    const lines: string[] = [
      '## E2E Test Report',
      '',
      `${status} — ${result.passed} passed, ${result.failed} failed${result.skipped > 0 ? `, ${result.skipped} skipped` : ''} (${totalDur})`,
      '',
      '| Suite | Status | Steps | Duration |',
      '|-------|--------|-------|----------|',
    ];

    for (const suite of result.suites) {
      const icon = suite.status === 'passed' ? '✅' : '❌';
      lines.push(
        `| ${suite.name} | ${icon} ${suite.status} | ${suite.steps.length} | ${formatDuration(suite.duration)} |`
      );
    }

    if (result.failed > 0) {
      lines.push('', '### Failed steps', '');
      for (const suite of result.suites) {
        for (const step of suite.steps) {
          if (step.status !== 'failed') continue;
          lines.push(`- **${suite.name}**: \`${stepLabel(step.step)}\``);
          if (step.error) {
            lines.push(`  - ${step.error}`);
          }
          if (step.screenshotPath) {
            lines.push(`  - Screenshot: \`${step.screenshotPath}\``);
          }
        }
      }
    }

    return lines.join('\n');
  }

  private writeFallback(body: string): void {
    mkdirSync(this.outputDir, { recursive: true });
    const path = join(this.outputDir, 'pr-comment.md');
    writeFileSync(path, body, 'utf-8');
    console.log(`PR comment body written to ${path} (not in a PR context or gh failed).`);
  }
}
