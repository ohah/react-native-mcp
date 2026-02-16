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
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals.length === 0 || positionals[0] !== 'run') {
  console.log(`Usage: react-native-mcp-test run <path> [options]

Commands:
  run <path>    Run YAML test file or directory

Options:
  -p, --platform <ios|android>   Platform override
  -r, --reporter <type>          Reporter: console, junit, json (default: console)
  -o, --output <dir>             Output directory (default: ./results)
  -t, --timeout <ms>             Global timeout override
  -d, --device <id>              Device ID
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
  const targetPath = resolve(target!);
  const suites = parsePath(targetPath);

  if (suites.length === 0) {
    console.error('No test suites found at:', targetPath);
    process.exit(1);
  }

  console.log(`Found ${suites.length} test suite(s)\n`);

  const reporter = createReporter(values.reporter!, values.output!);
  const result = await runAll(suites, reporter, {
    platform,
    output: values.output,
    timeout: values.timeout ? Number(values.timeout) : undefined,
    deviceId: values.device,
  });

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
