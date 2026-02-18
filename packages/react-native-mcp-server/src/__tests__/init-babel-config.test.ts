import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { updateBabelConfig } from '../init/babel-config.js';
import type { ProjectInfo } from '../init/detect.js';

function makeInfo(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    isExpo: false,
    rnVersion: '0.83.0',
    expoVersion: null,
    hasBabelConfig: true,
    babelConfigPath: null,
    packageManager: 'npm',
    ...overrides,
  };
}

describe('updateBabelConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-babel-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('babel config 없으면 실패 반환', () => {
    const result = updateBabelConfig(makeInfo({ hasBabelConfig: false, babelConfigPath: null }));
    expect(result.success).toBe(false);
    expect(result.skipped).toBe(false);
  });

  it('이미 프리셋 있으면 건너뜀 (멱등성)', () => {
    const configPath = path.join(tmpDir, 'babel.config.js');
    fs.writeFileSync(
      configPath,
      `module.exports = {
  presets: ['module:@react-native/babel-preset', '@ohah/react-native-mcp-server/babel-preset'],
};`
    );
    const result = updateBabelConfig(makeInfo({ babelConfigPath: configPath }));
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('bare RN babel.config.js에 프리셋 추가', () => {
    const configPath = path.join(tmpDir, 'babel.config.js');
    fs.writeFileSync(
      configPath,
      `module.exports = {
  presets: ['module:@react-native/babel-preset'],
};`
    );
    const result = updateBabelConfig(makeInfo({ babelConfigPath: configPath }));
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('@ohah/react-native-mcp-server/babel-preset');
    expect(content).toContain("'module:@react-native/babel-preset'");
  });

  it('Expo babel.config.js에 프리셋 추가', () => {
    const configPath = path.join(tmpDir, 'babel.config.js');
    fs.writeFileSync(
      configPath,
      `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};`
    );
    const result = updateBabelConfig(makeInfo({ babelConfigPath: configPath, isExpo: true }));
    expect(result.success).toBe(true);

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain("'babel-preset-expo'");
    expect(content).toContain("'@ohah/react-native-mcp-server/babel-preset'");
  });

  it('쉼표가 이미 있는 프리셋 배열', () => {
    const configPath = path.join(tmpDir, 'babel.config.js');
    fs.writeFileSync(
      configPath,
      `module.exports = {
  presets: ['module:@react-native/babel-preset',],
};`
    );
    const result = updateBabelConfig(makeInfo({ babelConfigPath: configPath }));
    expect(result.success).toBe(true);

    const content = fs.readFileSync(configPath, 'utf-8');
    // 쉼표 중복 없이 추가
    expect(content).not.toContain(',,');
    expect(content).toContain('@ohah/react-native-mcp-server/babel-preset');
  });

  it('presets 배열 없으면 수동 추가 안내', () => {
    const configPath = path.join(tmpDir, 'babel.config.js');
    fs.writeFileSync(configPath, `module.exports = {};`);
    const result = updateBabelConfig(makeInfo({ babelConfigPath: configPath }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('add manually');
  });

  it('두 번 실행해도 프리셋 중복 없음', () => {
    const configPath = path.join(tmpDir, 'babel.config.js');
    fs.writeFileSync(
      configPath,
      `module.exports = {
  presets: ['module:@react-native/babel-preset'],
};`
    );

    updateBabelConfig(makeInfo({ babelConfigPath: configPath }));
    const secondResult = updateBabelConfig(makeInfo({ babelConfigPath: configPath }));
    expect(secondResult.skipped).toBe(true);

    const content = fs.readFileSync(configPath, 'utf-8');
    const matches = content.match(/@ohah\/react-native-mcp-server\/babel-preset/g);
    expect(matches).toHaveLength(1);
  });
});
