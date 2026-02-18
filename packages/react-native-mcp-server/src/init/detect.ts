/**
 * 프로젝트 타입 감지 (Expo vs bare RN, 패키지 매니저, babel 설정 등)
 */
import fs from 'node:fs';
import path from 'node:path';

export interface ProjectInfo {
  isExpo: boolean;
  rnVersion: string | null;
  expoVersion: string | null;
  hasBabelConfig: boolean;
  babelConfigPath: string | null;
  packageManager: 'bun' | 'yarn' | 'npm' | 'pnpm';
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
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    rnVersion = deps['react-native'] ?? null;
    expoVersion = deps['expo'] ?? null;
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

function detectPackageManager(cwd: string): ProjectInfo['packageManager'] {
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock')))
    return 'bun';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  return 'npm';
}
