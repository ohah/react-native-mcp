import type { StepResult, SuiteResult, RunResult } from '../types.js';
import { ConsoleReporter } from './console.js';
import { JUnitReporter } from './junit.js';
import { JsonReporter } from './json.js';
import { HtmlReporter } from './html.js';
import { SlackReporter } from './slack.js';
import { GithubPrReporter } from './github-pr.js';

export interface Reporter {
  onSuiteStart(name: string): void;
  onStepResult(result: StepResult): void;
  onSuiteEnd(result: SuiteResult): void;
  onRunEnd(result: RunResult): void | Promise<void>;
}

export interface CreateReporterOptions {
  /** Slack 리포터용 웹훅 URL (또는 환경변수 SLACK_WEBHOOK_URL) */
  slackWebhook?: string;
  /** Slack 메시지에 넣을 리포트 링크 (CI 아티팩트 URL 등) */
  reportUrl?: string;
}

export function createReporter(
  type: string,
  outputDir: string,
  options: CreateReporterOptions = {}
): Reporter {
  switch (type) {
    case 'junit':
      return new JUnitReporter(outputDir);
    case 'json':
      return new JsonReporter(outputDir);
    case 'html':
      return new HtmlReporter(outputDir);
    case 'slack': {
      const webhook =
        options.slackWebhook ?? process.env.SLACK_WEBHOOK_URL ?? '';
      if (!webhook) {
        throw new Error(
          'Slack reporter requires --slack-webhook or SLACK_WEBHOOK_URL'
        );
      }
      return new SlackReporter({
        webhookUrl: webhook,
        reportUrl: options.reportUrl,
      });
    }
    case 'github-pr':
      return new GithubPrReporter({ outputDir });
    case 'console':
    default:
      return new ConsoleReporter();
  }
}

export { ConsoleReporter } from './console.js';
export { JUnitReporter } from './junit.js';
export { JsonReporter } from './json.js';
export { HtmlReporter } from './html.js';
export { SlackReporter } from './slack.js';
export { GithubPrReporter } from './github-pr.js';
