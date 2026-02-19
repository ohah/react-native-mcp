/**
 * `npx react-native-mcp init` 메인 플로우
 */
import fs from 'node:fs';
import path from 'node:path';
import { detectProject, checkExternalTools } from './detect.js';
import { updateBabelConfig } from './babel-config.js';
import { setupMcpConfig, MCP_CLIENTS, type McpClient } from './mcp-config.js';
import { select, closeRL } from './prompts.js';

interface InitOptions {
  client?: McpClient;
  interactive?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const interactive = options.interactive !== false;

  console.log();
  console.log('\x1b[1m React Native MCP Setup\x1b[0m');
  console.log();

  // 1. 프로젝트 감지
  console.log(' Detecting project...');
  const info = detectProject(cwd);

  if (!info.rnVersion) {
    console.log('  \x1b[33m⚠\x1b[0m React Native not found in package.json');
    console.log('    Make sure you are in a React Native project directory.');
    process.exitCode = 1;
    closeRL();
    return;
  }

  console.log(`  \x1b[32m✓\x1b[0m React Native ${info.rnVersion}`);
  if (info.isExpo) {
    console.log(
      `  \x1b[32m✓\x1b[0m Expo detected${info.expoVersion ? ` (expo@${info.expoVersion})` : ''}`
    );
  }
  console.log(`  \x1b[32m✓\x1b[0m Package manager: ${info.packageManager}`);

  // 1.5. 외부 도구 확인 (adb, idb)
  console.log();
  console.log(' Checking external tools...');
  const tools = checkExternalTools();
  let hasWarning = false;
  for (const tool of tools) {
    if (tool.installed) {
      console.log(`  \x1b[32m✓\x1b[0m ${tool.name} — found`);
    } else {
      hasWarning = true;
      console.log(`  \x1b[33m⚠\x1b[0m ${tool.name} — not found`);
      console.log(`    Install: ${tool.hint}`);
    }
  }
  if (!hasWarning) {
    console.log('  All tools ready!');
  }

  // 2. MCP 클라이언트 선택
  let client: McpClient;
  if (options.client) {
    client = options.client;
  } else if (interactive) {
    const selected = await select('? Which MCP client do you use?', MCP_CLIENTS, (c) => c.label);
    client = selected.value;
  } else {
    client = 'cursor';
  }

  console.log();
  console.log(' Applying changes...');

  // 3. Babel 설정 수정
  const babelResult = updateBabelConfig(info);
  if (babelResult.success) {
    console.log(
      `  \x1b[32m✓\x1b[0m ${info.babelConfigPath ? path.basename(info.babelConfigPath) : 'babel.config.js'} — ${babelResult.message}`
    );
  } else {
    console.log(`  \x1b[33m⚠\x1b[0m babel.config.js — ${babelResult.message}`);
  }

  // 4. MCP 클라이언트 설정
  const mcpResult = setupMcpConfig(client, cwd);
  if (mcpResult.success) {
    console.log(`  \x1b[32m✓\x1b[0m MCP config — ${mcpResult.message}`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m MCP config — ${mcpResult.message}`);
  }

  // 5. .gitignore 업데이트
  updateGitignore(cwd);

  // 6. 완료 메시지
  console.log();
  console.log('\x1b[32m Done!\x1b[0m Next steps:');
  if (info.isExpo) {
    console.log('  1. Start your app: npx expo start');
  } else {
    console.log('  1. Start Metro: REACT_NATIVE_MCP_ENABLED=true npx react-native start');
  }

  const clientLabel = MCP_CLIENTS.find((c) => c.value === client)?.label ?? client;
  console.log(`  2. Open ${clientLabel} — MCP tools are ready to use`);
  console.log();

  closeRL();
}

function updateGitignore(cwd: string): void {
  const gitignorePath = path.join(cwd, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return;

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  if (content.includes('/results/') || content.includes('results/')) {
    console.log('  \x1b[32m✓\x1b[0m .gitignore — already has results/');
    return;
  }

  fs.appendFileSync(gitignorePath, '\n# React Native MCP\n/results/\n', 'utf-8');
  console.log('  \x1b[32m✓\x1b[0m .gitignore — updated');
}
