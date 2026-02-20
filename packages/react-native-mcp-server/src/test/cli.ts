#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { parsePath } from './parser.js';
import { runAll } from './runner.js';
import { createReporter } from './reporters/index.js';
import { showReport } from './show-report.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    platform: { type: 'string', short: 'p' },
    reporter: { type: 'string', short: 'r', default: 'console' },
    output: { type: 'string', short: 'o', default: './results' },
    timeout: { type: 'string', short: 't' },
    device: { type: 'string', short: 'd' },
    port: { type: 'string' },
    'slack-webhook': { type: 'string' },
    'report-url': { type: 'string' },
    env: { type: 'string', short: 'e', multiple: true },
    'no-bail': { type: 'boolean' },
    'no-auto-launch': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

function printHelp(): void {
  console.log(`Usage: react-native-mcp-server test <command> [options]

Commands:
  run <path>       Run YAML test file or directory
  report show      Serve dashboard report and open in browser

Options (run):
  -p, --platform <ios|android>   Platform override
  -r, --reporter <type>          Reporter: console, junit, json, html, slack, github-pr, dashboard (default: console). With dashboard, opens report in browser after run.
  -o, --output <dir>             Output directory (default: ./results)
  -t, --timeout <ms>             Global timeout override
  -d, --device <id>              Device ID
  --slack-webhook <url>          Slack webhook URL (for -r slack; or set SLACK_WEBHOOK_URL)
  --report-url <url>             Report link for Slack message (e.g. CI artifact URL)
  -e, --env <KEY=VALUE>          Set environment variable (repeatable)
  --no-bail                      Continue running after suite failure
  --no-auto-launch               Do not launch app in create(); use setup launch step (e.g. CI install-only)

Options (report show):
  -o, --output <dir>             Directory containing dashboard/ (default: ./results)
  --port <number>                Port for local server (default: 9323)

  -h, --help                     Show help`);
}

if (values.help || positionals.length === 0) {
  printHelp();
  process.exit(values.help ? 0 : 1);
}

if (positionals[0] === 'report' && positionals[1] === 'show') {
  (async () => {
    const outputDir = resolve(values.output ?? './results');
    const dashboardDir = join(outputDir, 'dashboard');
    const port = values.port ? Number(values.port) : undefined;
    try {
      const server = await showReport(dashboardDir, { port, openBrowser: true });
      console.error(
        `Dashboard: http://127.0.0.1:${(server.address() as { port: number }).port}/ (Ctrl+C to stop)`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to start report server:', msg);
      process.exit(1);
    }
  })();
  // 서버가 살아 있는 한 프로세스 유지 (Ctrl+C로 종료)
} else if (positionals[0] === 'run') {
  const target = positionals[1];
  if (!target) {
    console.error('Error: path argument is required after "run"');
    process.exit(1);
  }
  runMain(target).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Fatal error:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
} else {
  printHelp();
  process.exit(1);
}

async function runMain(target: string): Promise<void> {
  const platform = values.platform as 'ios' | 'android' | undefined;
  if (platform && platform !== 'ios' && platform !== 'android') {
    console.error(`Error: invalid platform "${platform}". Must be "ios" or "android".`);
    process.exit(1);
  }

  const envVars: Record<string, string> = {};
  for (const pair of values.env ?? []) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }

  const targetPath = resolve(target);
  const suites = parsePath(targetPath, Object.keys(envVars).length > 0 ? envVars : undefined);

  if (suites.length === 0) {
    console.error('No test suites found at: ' + targetPath);
    process.exit(1);
  }

  console.log(`Found ${suites.length} test suite(s)\n`);

  const reporter = createReporter(values.reporter!, values.output!, {
    slackWebhook: values['slack-webhook'],
    reportUrl: values['report-url'],
  });
  const result = await runAll(suites, reporter, {
    platform,
    output: values.output,
    timeout: values.timeout ? Number(values.timeout) : undefined,
    deviceId: values.device,
    bail: !values['no-bail'],
    autoLaunch: !values['no-auto-launch'],
    envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
  });

  if (values.reporter === 'dashboard') {
    const dashboardDir = join(resolve(values.output ?? './results'), 'dashboard');
    try {
      const server = await showReport(dashboardDir, { openBrowser: true });
      const port = (server.address() as { port: number }).port;
      console.error('\nDashboard: http://127.0.0.1:' + port + '/ (Ctrl+C to stop)');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to open dashboard:', msg);
    }
  }

  process.exit(result.failed > 0 ? 1 : 0);
}
