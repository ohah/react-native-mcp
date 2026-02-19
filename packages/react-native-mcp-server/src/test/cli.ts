#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { parsePath } from './parser.js';
import { runAll } from './runner.js';
import { createReporter } from './reporters/index.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    platform: { type: 'string', short: 'p' },
    reporter: { type: 'string', short: 'r', default: 'console' },
    output: { type: 'string', short: 'o', default: './results' },
    timeout: { type: 'string', short: 't' },
    device: { type: 'string', short: 'd' },
    'slack-webhook': { type: 'string' },
    'report-url': { type: 'string' },
    env: { type: 'string', short: 'e', multiple: true },
    'no-bail': { type: 'boolean' },
    'no-auto-launch': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals.length === 0 || positionals[0] !== 'run') {
  console.log(`Usage: react-native-mcp-server test run <path> [options]

Commands:
  run <path>    Run YAML test file or directory

Options:
  -p, --platform <ios|android>   Platform override
  -r, --reporter <type>          Reporter: console, junit, json, html, slack, github-pr (default: console)
  -o, --output <dir>             Output directory (default: ./results)
  -t, --timeout <ms>             Global timeout override
  -d, --device <id>              Device ID
  --slack-webhook <url>          Slack webhook URL (for -r slack; or set SLACK_WEBHOOK_URL)
  --report-url <url>             Report link for Slack message (e.g. CI artifact URL)
  -e, --env <KEY=VALUE>          Set environment variable (repeatable)
  --no-bail                      Continue running after suite failure
  --no-auto-launch               Do not launch app in create(); use setup launch step (e.g. CI install-only)
  -h, --help                     Show help`);
  process.exit(values.help ? 0 : 1);
}

const target = positionals[1];
if (!target) {
  console.error('Error: path argument is required after "run"');
  process.exit(1);
}

const platform = values.platform as 'ios' | 'android' | undefined;
if (platform && platform !== 'ios' && platform !== 'android') {
  console.error(`Error: invalid platform "${platform}". Must be "ios" or "android".`);
  process.exit(1);
}

async function main() {
  // --env KEY=VALUE 파싱
  const envVars: Record<string, string> = {};
  for (const pair of values.env ?? []) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      envVars[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }

  const targetPath = resolve(target!);
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

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Fatal error:', msg);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
