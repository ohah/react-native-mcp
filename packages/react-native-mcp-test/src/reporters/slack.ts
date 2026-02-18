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

function escapeSlack(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface SlackReporterOptions {
  webhookUrl: string;
  /** 리포트 링크 (CI 아티팩트 URL 등). 있으면 메시지에 포함 */
  reportUrl?: string;
}

export class SlackReporter implements Reporter {
  private webhookUrl: string;
  private reportUrl?: string;

  constructor(options: SlackReporterOptions) {
    this.webhookUrl = options.webhookUrl;
    this.reportUrl = options.reportUrl;
  }

  onSuiteStart(_name: string): void {}
  onStepResult(_result: StepResult): void {}
  onSuiteEnd(_result: SuiteResult): void {}

  async onRunEnd(result: RunResult): Promise<void> {
    try {
      await this.sendToSlack(result);
    } catch (err) {
      console.error('Slack reporter failed to send:', err instanceof Error ? err.message : err);
    }
  }

  private async sendToSlack(result: RunResult): Promise<void> {
    const emoji = result.failed > 0 ? ':x:' : ':white_check_mark:';
    const totalDur = formatDuration(result.duration);
    const summary = `${emoji} E2E: ${result.passed} passed, ${result.failed} failed${result.skipped > 0 ? `, ${result.skipped} skipped` : ''} (${totalDur})`;

    const blocks: Record<string, unknown>[] = [
      { type: 'section', text: { type: 'mrkdwn', text: `*${summary}*` } },
    ];

    if (this.reportUrl) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `Report: <${this.reportUrl}|View report>` },
      });
    }

    if (result.failed > 0) {
      const failedLines: string[] = [];
      for (const suite of result.suites) {
        for (const step of suite.steps) {
          if (step.status !== 'failed') continue;
          const label = escapeSlack(stepLabel(step.step));
          const err = step.error ? escapeSlack(step.error) : '';
          failedLines.push(`• *${escapeSlack(suite.name)}* — \`${label}\`\n  ${err}`);
          if (step.screenshotPath) {
            failedLines.push(`  _Screenshot: \`${escapeSlack(step.screenshotPath)}\`_`);
          }
        }
      }
      if (failedLines.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Failed steps*\n' + failedLines.join('\n'),
          },
        });
      }
    }

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: summary, blocks }),
    });
    if (!res.ok) {
      throw new Error(`Slack webhook returned ${res.status}: ${await res.text()}`);
    }
  }
}
