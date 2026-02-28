import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectProject,
  detectProjectOrMonorepo,
  findRnAppsInMonorepo,
  checkExternalTools,
} from '../init/detect.js';

describe('detectProject', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('package.json 없으면 rnVersion null 반환', () => {
    const info = detectProject(tmpDir);
    expect(info.rnVersion).toBeNull();
    expect(info.isExpo).toBe(false);
  });

  it('파손된 package.json이면 rnVersion null 반환', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{not valid json!!');
    const info = detectProject(tmpDir);
    expect(info.rnVersion).toBeNull();
    expect(info.isExpo).toBe(false);
  });

  it('bare RN 프로젝트 감지', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.1' } })
    );
    const info = detectProject(tmpDir);
    expect(info.rnVersion).toBe('0.83.1');
    expect(info.isExpo).toBe(false);
  });

  it('devDependencies에만 react-native 있어도 감지', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { 'react-native': '0.72.0' } })
    );
    const info = detectProject(tmpDir);
    expect(info.rnVersion).toBe('0.72.0');
  });

  it('react-native가 dependencies/devDependencies 둘 다 없으면 null', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' } })
    );
    const info = detectProject(tmpDir);
    expect(info.rnVersion).toBeNull();
  });

  it('Expo 프로젝트 감지 — expo dependency', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { 'react-native': '0.76.0', expo: '~52.0.0' },
      })
    );
    const info = detectProject(tmpDir);
    expect(info.isExpo).toBe(true);
    expect(info.expoVersion).toBe('~52.0.0');
  });

  it('Expo 프로젝트 감지 — app.json 존재', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.76.0' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'app.json'), '{}');
    const info = detectProject(tmpDir);
    expect(info.isExpo).toBe(true);
    expect(info.expoVersion).toBeNull();
  });

  it('Expo 프로젝트 감지 — app.config.ts 존재', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.76.0' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'app.config.ts'), 'export default {}');
    const info = detectProject(tmpDir);
    expect(info.isExpo).toBe(true);
  });

  describe('babel config 감지', () => {
    it('babel.config.js 존재', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
      );
      fs.writeFileSync(path.join(tmpDir, 'babel.config.js'), 'module.exports = {}');
      const info = detectProject(tmpDir);
      expect(info.hasBabelConfig).toBe(true);
      expect(info.babelConfigPath).toBe(path.join(tmpDir, 'babel.config.js'));
    });

    it('.babelrc 존재', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
      );
      fs.writeFileSync(path.join(tmpDir, '.babelrc'), '{}');
      const info = detectProject(tmpDir);
      expect(info.hasBabelConfig).toBe(true);
      expect(info.babelConfigPath).toBe(path.join(tmpDir, '.babelrc'));
    });

    it('babel config 없으면 null', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
      );
      const info = detectProject(tmpDir);
      expect(info.hasBabelConfig).toBe(false);
      expect(info.babelConfigPath).toBeNull();
    });
  });

  describe('패키지 매니저 감지', () => {
    it('bun.lock → bun', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '');
      expect(detectProject(tmpDir).packageManager).toBe('bun');
    });

    it('bun.lockb → bun', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
      expect(detectProject(tmpDir).packageManager).toBe('bun');
    });

    it('yarn.lock → yarn', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
      expect(detectProject(tmpDir).packageManager).toBe('yarn');
    });

    it('pnpm-lock.yaml → pnpm', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
      expect(detectProject(tmpDir).packageManager).toBe('pnpm');
    });

    it('lock 파일 없으면 npm 기본값', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      expect(detectProject(tmpDir).packageManager).toBe('npm');
    });
  });
});

describe('findRnAppsInMonorepo', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-monorepo-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('workspaces 없으면 빈 배열', () => {
    fs.writeFileSync(path.join(rootDir, 'package.json'), '{}');
    expect(findRnAppsInMonorepo(rootDir)).toEqual([]);
  });

  it('workspaces에 있는 RN 앱만 반환', () => {
    fs.writeFileSync(
      path.join(rootDir, 'package.json'),
      JSON.stringify({ workspaces: ['examples/*'] })
    );
    const ex = path.join(rootDir, 'examples');
    fs.mkdirSync(ex, { recursive: true });
    const app1 = path.join(ex, 'demo-app');
    const app2 = path.join(ex, 'other');
    fs.mkdirSync(app1, { recursive: true });
    fs.mkdirSync(app2, { recursive: true });
    fs.writeFileSync(
      path.join(app1, 'package.json'),
      JSON.stringify({ name: 'demo', dependencies: { 'react-native': '0.83.0' } })
    );
    fs.writeFileSync(
      path.join(app2, 'package.json'),
      JSON.stringify({ name: 'other', dependencies: {} })
    );
    const found = findRnAppsInMonorepo(rootDir);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(app1);
  });

  it('여러 RN 앱이면 모두 반환', () => {
    fs.writeFileSync(
      path.join(rootDir, 'package.json'),
      JSON.stringify({ workspaces: ['packages/*', 'examples/*'] })
    );
    const pkg = path.join(rootDir, 'packages');
    const ex = path.join(rootDir, 'examples');
    fs.mkdirSync(pkg, { recursive: true });
    fs.mkdirSync(ex, { recursive: true });
    const pkgApp = path.join(pkg, 'mobile');
    const exApp = path.join(ex, 'demo-app');
    fs.mkdirSync(pkgApp, { recursive: true });
    fs.mkdirSync(exApp, { recursive: true });
    fs.writeFileSync(
      path.join(pkgApp, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.72.0' } })
    );
    fs.writeFileSync(
      path.join(exApp, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const found = findRnAppsInMonorepo(rootDir);
    expect(found).toHaveLength(2);
    expect(found).toContain(pkgApp);
    expect(found).toContain(exApp);
  });

  it('workspaces가 단일 경로(glob 아님)여도 패키지 탐색', () => {
    fs.writeFileSync(
      path.join(rootDir, 'package.json'),
      JSON.stringify({ workspaces: ['apps/mobile'] })
    );
    const appDir = path.join(rootDir, 'apps', 'mobile');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ name: 'mobile', dependencies: { 'react-native': '0.83.0' } })
    );
    const found = findRnAppsInMonorepo(rootDir);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(appDir);
  });

  it('workspaces glob의 base 디렉터리가 없으면 해당 패턴 무시', () => {
    fs.writeFileSync(
      path.join(rootDir, 'package.json'),
      JSON.stringify({ workspaces: ['nonexistent/*', 'examples/*'] })
    );
    const ex = path.join(rootDir, 'examples');
    fs.mkdirSync(ex, { recursive: true });
    const appDir = path.join(ex, 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const found = findRnAppsInMonorepo(rootDir);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(appDir);
  });

  it('워크스페이스 패키지에 package.json 없으면 목록에 미포함', () => {
    fs.writeFileSync(
      path.join(rootDir, 'package.json'),
      JSON.stringify({ workspaces: ['apps/*'] })
    );
    const appsDir = path.join(rootDir, 'apps');
    fs.mkdirSync(appsDir, { recursive: true });
    const withPkg = path.join(appsDir, 'with-pkg');
    const noPkg = path.join(appsDir, 'no-pkg');
    fs.mkdirSync(withPkg, { recursive: true });
    fs.mkdirSync(noPkg, { recursive: true });
    fs.writeFileSync(
      path.join(withPkg, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const found = findRnAppsInMonorepo(rootDir);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(withPkg);
  });

  it('devDependencies에만 react-native 있는 워크스페이스 패키지도 RN 앱으로 인식', () => {
    fs.writeFileSync(
      path.join(rootDir, 'package.json'),
      JSON.stringify({ workspaces: ['apps/*'] })
    );
    const appDir = path.join(rootDir, 'apps', 'my-app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ devDependencies: { 'react-native': '0.72.0' } })
    );
    const found = findRnAppsInMonorepo(rootDir);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(appDir);
  });

  it('루트 package.json이 파손되면 빈 배열', () => {
    fs.writeFileSync(path.join(rootDir, 'package.json'), '{ invalid json');
    const found = findRnAppsInMonorepo(rootDir);
    expect(found).toEqual([]);
  });
});

describe('detectProjectOrMonorepo', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-detect-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('cwd에 RN 있으면 단일 레포 결과', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const result = detectProjectOrMonorepo(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.appRoot).toBe(tmpDir);
    expect(result!.info.rnVersion).toBe('0.83.0');
    expect(result!.isMonorepo).toBe(false);
    expect(result!.candidateAppRoots).toBeUndefined();
  });

  it('cwd에 RN 없고 워크스페이스에 RN 앱 하나면 모노레포 결과', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ workspaces: ['examples/*'] })
    );
    const ex = path.join(tmpDir, 'examples', 'app');
    fs.mkdirSync(ex, { recursive: true });
    fs.writeFileSync(
      path.join(ex, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const result = detectProjectOrMonorepo(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.appRoot).toBe(ex);
    expect(result!.info.rnVersion).toBe('0.83.0');
    expect(result!.isMonorepo).toBe(true);
  });

  it('explicitAppPath 지정 시 해당 경로로 결과', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const appDir = path.join(tmpDir, 'examples', 'my-app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.72.0' } })
    );
    const result = detectProjectOrMonorepo(tmpDir, 'examples/my-app');
    expect(result).not.toBeNull();
    expect(result!.appRoot).toBe(path.resolve(tmpDir, 'examples/my-app'));
    expect(result!.info.rnVersion).toBe('0.72.0');
    expect(result!.isMonorepo).toBe(true);
  });

  it('explicitAppPath에 절대 경로 지정 시 해당 경로 사용', () => {
    const appDir = path.join(tmpDir, 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.70.0' } })
    );
    const result = detectProjectOrMonorepo('/other/cwd', appDir);
    expect(result).not.toBeNull();
    expect(result!.appRoot).toBe(appDir);
    expect(result!.info.rnVersion).toBe('0.70.0');
  });

  it('explicitAppPath가 존재하지 않으면 null', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const result = detectProjectOrMonorepo(tmpDir, 'nonexistent/path');
    expect(result).toBeNull();
  });

  it('explicitAppPath가 package.json 없는 디렉터리면 null', () => {
    const emptyDir = path.join(tmpDir, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    const result = detectProjectOrMonorepo(tmpDir, 'empty');
    expect(result).toBeNull();
  });

  it('explicitAppPath가 RN 없는 패키지면 null', () => {
    const appDir = path.join(tmpDir, 'lib');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ name: 'lib', dependencies: {} })
    );
    const result = detectProjectOrMonorepo(tmpDir, 'lib');
    expect(result).toBeNull();
  });

  it('모노레포에서 RN 앱 2개 이상이면 candidateAppRoots에 상대 경로로 채워짐', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ workspaces: ['packages/*', 'examples/*'] })
    );
    const pkg = path.join(tmpDir, 'packages');
    const ex = path.join(tmpDir, 'examples');
    fs.mkdirSync(pkg, { recursive: true });
    fs.mkdirSync(ex, { recursive: true });
    const pkgApp = path.join(pkg, 'mobile');
    const exApp = path.join(ex, 'demo-app');
    fs.mkdirSync(pkgApp, { recursive: true });
    fs.mkdirSync(exApp, { recursive: true });
    fs.writeFileSync(
      path.join(pkgApp, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.72.0' } })
    );
    fs.writeFileSync(
      path.join(exApp, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    const result = detectProjectOrMonorepo(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.candidateAppRoots).toBeDefined();
    expect(result!.candidateAppRoots).toHaveLength(2);
    expect(result!.candidateAppRoots).toContain(path.relative(tmpDir, pkgApp));
    expect(result!.candidateAppRoots).toContain(path.relative(tmpDir, exApp));
    expect(result!.appRoot).toBe(pkgApp);
  });

  it('RN 없고 모노레포도 아니면 null', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    expect(detectProjectOrMonorepo(tmpDir)).toBeNull();
  });
});

describe('checkExternalTools', () => {
  it('returns array of tool statuses', () => {
    const tools = checkExternalTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThanOrEqual(1);

    // adb should always be checked
    const adb = tools.find((t) => t.name === 'adb');
    expect(adb).toBeDefined();
    expect(typeof adb!.installed).toBe('boolean');
    expect(typeof adb!.hint).toBe('string');
  });

  it('checks idb on macOS', () => {
    const tools = checkExternalTools();
    if (process.platform === 'darwin') {
      const idb = tools.find((t) => t.name === 'idb');
      expect(idb).toBeDefined();
      expect(typeof idb!.installed).toBe('boolean');
    }
  });

  it('each tool has required fields', () => {
    const tools = checkExternalTools();
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('installed');
      expect(tool).toHaveProperty('version');
      expect(tool).toHaveProperty('hint');
    }
  });
});
