/**
 * `npx react-native-mcp init` 메인 플로우
 * 단일 레포·모노레포 모두 지원 (모노레포 시 워크스페이스 내 RN 앱 자동 탐색)
 */
import fs from 'node:fs';
import path from 'node:path';
import { detectProjectOrMonorepo, detectProject, checkExternalTools } from './detect.js';
import { updateBabelConfig } from './babel-config.js';
import { addPackageToApp, runInstall } from './add-package.js';
import { setupMcpConfig, MCP_CLIENTS, type McpClient } from './mcp-config.js';
import { select, closeRL } from './prompts.js';

interface InitOptions {
  client?: McpClient;
  interactive?: boolean;
  /** 모노레포에서 초기화할 앱 경로 (상대 또는 절대). 없으면 자동 탐색 또는 선택 */
  appPath?: string;
  /** package.json에만 추가하고 install 생략 (CI 등) */
  noInstall?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const interactive = options.interactive !== false;

  console.log();
  console.log('\x1b[1m React Native MCP Setup\x1b[0m');
  console.log();

  // 1. 프로젝트 감지 (단일 레포 또는 모노레포)
  console.log(' Detecting project...');
  const result = detectProjectOrMonorepo(cwd, options.appPath);

  if (!result) {
    console.log('  \x1b[33m⚠\x1b[0m React Native not found in package.json');
    console.log(
      '    Run this command from a React Native app directory, or from a monorepo root that has workspace packages containing react-native.'
    );
    if (options.appPath) {
      console.log(`    Or check that --app path exists and has react-native: ${options.appPath}`);
    }
    process.exitCode = 1;
    closeRL();
    return;
  }

  const { appRoot, info, isMonorepo, candidateAppRoots } = result;
  let effectiveAppRoot = appRoot;

  if (candidateAppRoots && candidateAppRoots.length > 1 && interactive) {
    const choices = candidateAppRoots.map((rel) => ({
      label: rel,
      value: path.resolve(cwd, rel),
    }));
    const selected = await select(
      '? Which React Native app do you want to set up?',
      choices,
      (c) => c.label
    );
    effectiveAppRoot = selected.value;
  } else if (candidateAppRoots && candidateAppRoots.length > 1 && !interactive) {
    effectiveAppRoot = path.resolve(cwd, candidateAppRoots[0]);
  }

  const infoToUse = effectiveAppRoot === appRoot ? info : detectProject(effectiveAppRoot);

  if (isMonorepo) {
    const rel = path.relative(cwd, effectiveAppRoot);
    console.log(`  \x1b[32m✓\x1b[0m Monorepo detected — using app at \x1b[36m${rel}\x1b[0m`);
  }

  console.log(`  \x1b[32m✓\x1b[0m React Native ${infoToUse.rnVersion}`);
  if (infoToUse.isExpo) {
    console.log(
      `  \x1b[32m✓\x1b[0m Expo detected${infoToUse.expoVersion ? ` (expo@${infoToUse.expoVersion})` : ''}`
    );
  }
  console.log(`  \x1b[32m✓\x1b[0m Package manager: ${infoToUse.packageManager}`);

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

  // 2.5. 앱 package.json에 @ohah/react-native-mcp-server 추가 및 (선택) install
  const addResult = addPackageToApp(effectiveAppRoot);
  if (addResult.added) {
    console.log(`  \x1b[32m✓\x1b[0m package.json — ${addResult.message}`);
    if (!options.noInstall) {
      const installDir = isMonorepo ? cwd : effectiveAppRoot;
      const installResult = runInstall(installDir, infoToUse.packageManager);
      if (installResult.ok) {
        console.log(`  \x1b[32m✓\x1b[0m ${infoToUse.packageManager} install — done`);
      } else {
        console.log(
          `  \x1b[33m⚠\x1b[0m ${infoToUse.packageManager} install — failed. Run manually: cd ${path.relative(cwd, installDir) || '.'} && ${infoToUse.packageManager === 'yarn' ? 'yarn' : `${infoToUse.packageManager} install`}`
        );
      }
    }
  } else if (addResult.message === 'already in package.json') {
    console.log(`  \x1b[32m✓\x1b[0m package.json — ${addResult.message}`);
  }

  // 3. Babel 설정 수정 (앱 루트의 babel.config)
  const babelResult = updateBabelConfig(infoToUse);
  if (babelResult.success) {
    console.log(
      `  \x1b[32m✓\x1b[0m ${infoToUse.babelConfigPath ? path.basename(infoToUse.babelConfigPath) : 'babel.config.js'} — ${babelResult.message}`
    );
  } else {
    console.log(`  \x1b[33m⚠\x1b[0m babel.config.js — ${babelResult.message}`);
  }

  // 4. MCP 클라이언트 설정 (실행한 cwd에 생성 — 모노레포 루트에서 실행 시 .cursor는 루트에)
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
  if (isMonorepo) {
    const rel = path.relative(cwd, effectiveAppRoot);
    console.log(`  1. Go to app directory: cd ${rel}`);
  }
  if (infoToUse.isExpo) {
    console.log(`  ${isMonorepo ? '2' : '1'}. Start your app: npx expo start`);
  } else {
    console.log(
      `  ${isMonorepo ? '2' : '1'}. Start Metro: REACT_NATIVE_MCP_ENABLED=true npx react-native start`
    );
  }

  const clientLabel = MCP_CLIENTS.find((c) => c.value === client)?.label ?? client;
  const stepOpen = isMonorepo ? 3 : 2;
  console.log(`  ${stepOpen}. Open ${clientLabel} — MCP tools are ready to use`);
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
