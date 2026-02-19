import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectProject, checkExternalTools } from '../init/detect.js';

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
