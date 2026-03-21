#!/usr/bin/env node
/**
 * rn-mcp CLI — React Native 앱 제어 CLI (Snapshot + Refs 패턴)
 *
 * MCP 프로토콜 없이 셸에서 직접 React Native 앱을 제어.
 * AI 에이전트 (Claude Code, Codex 등)가 셸 명령으로 앱과 상호작용.
 */

import { parseArgs } from 'node:util';
import { VERSION } from './version.js';

// ─── Help text ───────────────────────────────────────────────────

const HELP = `
rn-mcp v${VERSION} — React Native app control CLI (Snapshot + Refs)

USAGE
  rn-mcp <command> [options]

WORKFLOW (IMPORTANT — follow this order)
  1. rn-mcp status              Check connection (is the app running?)
  2. rn-mcp snapshot -i         Get interactive elements as @refs
  3. rn-mcp tap @e3             Interact using @refs
  4. rn-mcp snapshot -i         Refresh refs after screen change

  ⚠ iOS: orientation is handled automatically during tap/swipe.
  ⚠ Refs become invalid after screen transitions — re-run snapshot.
  ⚠ If a ref returns "not found", run snapshot -i to refresh.

COMMANDS
  status                        Show connection status and devices
  snapshot [-i] [--max-depth N] Capture component tree with @refs
    -i, --interactive           Interactive elements only (recommended)
    --max-depth N               Tree depth limit (default: 30)

  tap <@ref|selector>           Tap an element
    --long <ms>                 Long press duration in ms

  type <@ref|selector> <text>   Type text into TextInput

  swipe <@ref|selector> <dir>   Swipe on element
    <dir>: up, down, left, right
    --dist <dp>                 Swipe distance in dp

  key <button>                  Press hardware button
    <button>: back, home, enter, tab, delete, up, down, left, right

  assert text <text>            Verify text exists on screen
  assert visible <@ref|sel>     Verify element is visible
  assert not-visible <@ref|sel> Verify element is NOT visible
  assert count <selector> <n>   Verify element count

  query <selector>              Query element info (coords, uid)
  query --all <selector>        Query all matching elements

  screenshot [-o <file>]        Save screenshot

  init-agent                    Add CLI guide to AGENTS.md / CLAUDE.md
    --target <agents|claude|all>  Target file (default: all)
    --lang <en|ko>              Guide language (default: en)

GLOBAL OPTIONS
  -d, --device <id>             Target device (when multiple connected)
  -p, --platform <ios|android>  Target platform
  --port <n>                    WebSocket port (default: 12300)
  --json                        JSON output for scripting
  --timeout <ms>                Command timeout (default: 10000)
  -h, --help                    Show this help
  -v, --version                 Show version

REFS SYSTEM
  snapshot assigns @e1, @e2, ... to each element (depth-first order).
  Use refs in subsequent commands: tap @e3, type @e5 "hello"
  Refs are saved to ~/.rn-mcp/session.json between CLI calls.
  Running snapshot again invalidates ALL previous refs.

SELECTORS (alternative to refs)
  #testID                       Match by testID
  Type                          Match by component type (e.g. Pressable)
  Type#testID                   Combine type and testID
  Type:text("label")            Match by type and text content
  #parent > #child              Direct child combinator
  See: npx react-native-mcp-server doctor for full syntax

EXAMPLES
  rn-mcp status
  rn-mcp snapshot -i
  rn-mcp tap @e3
  rn-mcp tap "#login-btn"
  rn-mcp tap @e3 --long 500
  rn-mcp type @e5 "user@example.com"
  rn-mcp swipe @e2 down --dist 300
  rn-mcp key back
  rn-mcp assert text "Welcome"
  rn-mcp assert visible @e3
  rn-mcp query "#my-button"
  rn-mcp screenshot -o login.png

PREREQUISITES
  - MCP server must be running (started by your editor or manually)
  - App must be connected via WebSocket (port 12300)
  - iOS: idb installed (brew tap facebook/fb && brew install idb-companion)
  - Android: adb installed (brew install android-platform-tools)
`.trim();

// ─── Arg parsing ─────────────────────────────────────────────────

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
    device: { type: 'string', short: 'd' },
    platform: { type: 'string', short: 'p' },
    port: { type: 'string', default: '12300' },
    json: { type: 'boolean', default: false },
    timeout: { type: 'string', default: '10000' },
    interactive: { type: 'boolean', short: 'i', default: false },
    'max-depth': { type: 'string', default: '30' },
    long: { type: 'string' },
    dist: { type: 'string' },
    all: { type: 'boolean', default: false },
    output: { type: 'string', short: 'o' },
    target: { type: 'string', default: 'all' },
    lang: { type: 'string', default: 'en' },
  },
  allowPositionals: true,
  strict: false,
});

if (values.version) {
  console.log(`rn-mcp v${VERSION}`);
  process.exit(0);
}

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(0);
}

const globalOpts = {
  device: values.device as string | undefined,
  platform: values.platform as string | undefined,
  port: parseInt(values.port as string, 10),
  json: values.json as boolean,
  timeout: parseInt(values.timeout as string, 10),
};

// ─── Command routing ─────────────────────────────────────────────

const command = positionals[0];
const restArgs = positionals.slice(1);

async function run(): Promise<void> {
  // Lazy import to speed up --help/--version
  const {
    cmdStatus,
    cmdSnapshot,
    cmdTap,
    cmdType,
    cmdAssert,
    cmdQuery,
    cmdSwipe,
    cmdKey,
    cmdScreenshot,
    cmdInitAgent,
  } = await import('./cli/commands.js');

  switch (command) {
    case 'status':
      return cmdStatus(globalOpts);

    case 'snapshot':
      return cmdSnapshot({
        ...globalOpts,
        interactive: values.interactive as boolean,
        maxDepth: parseInt(values['max-depth'] as string, 10),
      });

    case 'tap': {
      const target = restArgs[0];
      if (!target) {
        console.error('Usage: rn-mcp tap <@ref|selector>');
        process.exit(1);
      }
      return cmdTap(target, {
        ...globalOpts,
        long: values.long ? parseInt(values.long as string, 10) : undefined,
      });
    }

    case 'type': {
      const target = restArgs[0];
      const text = restArgs[1];
      if (!target || text == null) {
        console.error('Usage: rn-mcp type <@ref|selector> <text>');
        process.exit(1);
      }
      return cmdType(target, text, globalOpts);
    }

    case 'assert': {
      const sub = restArgs[0];
      if (!sub) {
        console.error('Usage: rn-mcp assert <text|visible|not-visible|count> ...');
        process.exit(1);
      }
      return cmdAssert(sub, restArgs.slice(1), globalOpts);
    }

    case 'query': {
      const selector = restArgs[0];
      if (!selector) {
        console.error('Usage: rn-mcp query <selector> [--all]');
        process.exit(1);
      }
      return cmdQuery(selector, { ...globalOpts, all: values.all as boolean });
    }

    case 'swipe': {
      const target = restArgs[0];
      const direction = restArgs[1];
      if (!target || !direction) {
        console.error('Usage: rn-mcp swipe <@ref|selector> <up|down|left|right>');
        process.exit(1);
      }
      return cmdSwipe(target, direction, {
        ...globalOpts,
        dist: values.dist ? parseInt(values.dist as string, 10) : undefined,
      });
    }

    case 'key': {
      const button = restArgs[0];
      if (!button) {
        console.error('Usage: rn-mcp key <back|home|enter|tab|delete|up|down|left|right>');
        process.exit(1);
      }
      return cmdKey(button, globalOpts);
    }

    case 'screenshot':
      return cmdScreenshot({
        ...globalOpts,
        output: values.output as string | undefined,
      });

    case 'init-agent':
      return cmdInitAgent({
        target: values.target as string,
        lang: values.lang as string,
      });

    default:
      console.error(`Unknown command: ${command}\nRun \`rn-mcp --help\` for usage.`);
      process.exit(1);
  }
}

run().catch((err: Error) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
