/**
 * 프로젝트 타입 감지 (Expo vs bare RN, 패키지 매니저, babel 설정 등)
 * 모노레포: 워크스페이스 내 RN 앱 탐색 지원
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export interface ProjectInfo {
  isExpo: boolean;
  rnVersion: string | null;
  expoVersion: string | null;
  hasBabelConfig: boolean;
  babelConfigPath: string | null;
  packageManager: 'bun' | 'yarn' | 'npm' | 'pnpm';
}

/** 단일 레포: appRoot === cwd. 모노레포: appRoot는 워크스페이스 내 RN 앱 경로 */
export interface DetectResult {
  appRoot: string;
  info: ProjectInfo;
  isMonorepo: boolean;
  /** 모노레포에서 RN 앱이 여러 개일 때 선택용 (상대 경로) */
  candidateAppRoots?: string[];
}

const BABEL_CONFIG_FILES = [
  'babel.config.js',
  'babel.config.cjs',
  'babel.config.mjs',
  '.babelrc',
  '.babelrc.js',
];

export function detectProject(cwd: string): ProjectInfo {
  const pkgPath = path.join(cwd, 'package.json');
  let rnVersion: string | null = null;
  let expoVersion: string | null = null;

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      rnVersion = deps['react-native'] ?? null;
      expoVersion = deps['expo'] ?? null;
    } catch {
      // corrupted or non-JSON package.json — treat as no project
    }
  }

  const isExpo =
    expoVersion != null ||
    fs.existsSync(path.join(cwd, 'app.json')) ||
    fs.existsSync(path.join(cwd, 'app.config.js')) ||
    fs.existsSync(path.join(cwd, 'app.config.ts'));

  let babelConfigPath: string | null = null;
  for (const name of BABEL_CONFIG_FILES) {
    const full = path.join(cwd, name);
    if (fs.existsSync(full)) {
      babelConfigPath = full;
      break;
    }
  }

  return {
    isExpo,
    rnVersion,
    expoVersion,
    hasBabelConfig: babelConfigPath != null,
    babelConfigPath,
    packageManager: detectPackageManager(cwd),
  };
}

/** package.json workspaces 배열에서 패키지 디렉터리 목록 반환 (루트 기준) */
function getWorkspacePackageDirs(rootDir: string): string[] {
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  let pkg: { workspaces?: string[] };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return [];
  }
  const workspaces = pkg.workspaces;
  if (!Array.isArray(workspaces) || workspaces.length === 0) return [];

  const dirs: string[] = [];
  for (const pattern of workspaces) {
    const globMatch = pattern.match(/^(.+)\/\*$/);
    if (globMatch) {
      const base = path.join(rootDir, globMatch[1]);
      if (!fs.existsSync(base)) continue;
      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.')) {
          const subPath = path.join(base, e.name);
          if (fs.existsSync(path.join(subPath, 'package.json'))) {
            dirs.push(subPath);
          }
        }
      }
    } else {
      const full = path.join(rootDir, pattern);
      if (fs.existsSync(full) && fs.existsSync(path.join(full, 'package.json'))) {
        dirs.push(full);
      }
    }
  }
  return dirs;
}

/** 디렉터리가 React Native 앱인지 (dependencies/devDependencies에 react-native 존재) */
function hasReactNativeInPackage(dir: string): boolean {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const rn = deps['react-native'];
    return rn != null && typeof rn === 'string';
  } catch {
    return false;
  }
}

/** 모노레포 루트에서 워크스페이스 내 RN 앱 경로 목록 반환 */
export function findRnAppsInMonorepo(rootDir: string): string[] {
  const dirs = getWorkspacePackageDirs(rootDir);
  return dirs.filter(hasReactNativeInPackage);
}

/**
 * cwd에서 프로젝트 감지. cwd에 react-native가 없으면 모노레포인지 확인하고
 * 워크스페이스 내 RN 앱 중 하나를 appRoot로 사용할 수 있게 결과 반환.
 * appRoot 선택은 호출측에서 (단일 후보면 그대로, 복수면 선택 또는 --app).
 */
export function detectProjectOrMonorepo(
  cwd: string,
  explicitAppPath?: string
): DetectResult | null {
  if (explicitAppPath) {
    const appRoot = path.isAbsolute(explicitAppPath)
      ? explicitAppPath
      : path.resolve(cwd, explicitAppPath);
    if (!fs.existsSync(path.join(appRoot, 'package.json'))) return null;
    const info = detectProject(appRoot);
    if (!info.rnVersion) return null;
    return { appRoot, info, isMonorepo: true };
  }

  const info = detectProject(cwd);
  if (info.rnVersion) {
    return { appRoot: cwd, info, isMonorepo: false };
  }

  const rnApps = findRnAppsInMonorepo(cwd);
  if (rnApps.length === 0) return null;
  const appRoot = rnApps[0];
  const appInfo = detectProject(appRoot);
  const candidateAppRoots =
    rnApps.length > 1 ? rnApps.map((d) => path.relative(cwd, d)) : undefined;
  return {
    appRoot,
    info: appInfo,
    isMonorepo: true,
    candidateAppRoots,
  };
}

function detectPackageManager(cwd: string): ProjectInfo['packageManager'] {
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock')))
    return 'bun';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  return 'npm';
}

// ─── External tool detection ───

export interface ToolStatus {
  name: string;
  installed: boolean;
  version: string | null;
  hint: string;
}

function checkCommand(
  cmd: string,
  versionFlag = '--version'
): { installed: boolean; version: string | null } {
  try {
    const output = execSync(`${cmd} ${versionFlag}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    })
      .toString()
      .trim();
    // Extract first line, strip common prefixes
    const firstLine = output.split('\n')[0];
    return { installed: true, version: firstLine };
  } catch {
    return { installed: false, version: null };
  }
}

export function checkExternalTools(): ToolStatus[] {
  const isMac = process.platform === 'darwin';
  const tools: ToolStatus[] = [];

  const docsBase = 'https://ohah.github.io/react-native-mcp/mcp/#4-native-tools-idb--adb';

  // adb — needed for Android
  const adb = checkCommand('adb');
  tools.push({
    name: 'adb',
    installed: adb.installed,
    version: adb.version,
    hint: isMac
      ? `brew install android-platform-tools  or  install Android Studio\n    Docs: ${docsBase}`
      : `Install Android Studio (includes adb)  or  sudo apt install adb\n    Docs: ${docsBase}`,
  });

  // idb — needed for iOS (macOS only)
  if (isMac) {
    const idb = checkCommand('idb');
    tools.push({
      name: 'idb',
      installed: idb.installed,
      version: idb.version,
      hint: `brew tap facebook/fb && brew install idb-companion\n    Docs: ${docsBase}`,
    });
  }

  return tools;
}
