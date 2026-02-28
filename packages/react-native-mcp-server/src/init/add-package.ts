/**
 * 앱 package.json에 @ohah/react-native-mcp-server를 devDependency로 추가하고,
 * 필요 시 패키지 매니저 install 실행
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { ProjectInfo } from './detect.js';

const PACKAGE_NAME = '@ohah/react-native-mcp-server';
const VERSION_RANGE = '^0.1.0';

export interface AddPackageResult {
  added: boolean;
  message: string;
}

/**
 * 앱 루트의 package.json에 @ohah/react-native-mcp-server를 devDependency로 추가.
 * 이미 있으면 건너뜀.
 */
export function addPackageToApp(appRoot: string): AddPackageResult {
  const pkgPath = path.join(appRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { added: false, message: 'package.json not found' };
  }

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return { added: false, message: 'package.json invalid' };
  }

  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  if (deps[PACKAGE_NAME] != null || devDeps[PACKAGE_NAME] != null) {
    return { added: false, message: 'already in package.json' };
  }

  pkg.devDependencies = { ...devDeps, [PACKAGE_NAME]: VERSION_RANGE };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  return { added: true, message: 'added to devDependencies' };
}

/**
 * 지정한 디렉터리에서 패키지 매니저 install 실행 (lockfile 갱신 포함).
 * 실패 시 예외 없이 false 반환.
 */
export function runInstall(
  dir: string,
  packageManager: ProjectInfo['packageManager']
): { ok: boolean; error?: string } {
  const commands: Record<ProjectInfo['packageManager'], string> = {
    bun: 'bun install',
    npm: 'npm install',
    pnpm: 'pnpm install',
    yarn: 'yarn',
  };
  const cmd = commands[packageManager];
  try {
    execSync(cmd, {
      cwd: dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
