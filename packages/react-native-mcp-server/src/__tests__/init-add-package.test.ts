import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { addPackageToApp, runInstall } from '../init/add-package.js';

describe('addPackageToApp', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-add-pkg-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('package.json 없으면 added: false', () => {
    const result = addPackageToApp(tmpDir);
    expect(result.added).toBe(false);
    expect(result.message).toBe('package.json not found');
  });

  it('package.json 파손되면 added: false', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ invalid');
    const result = addPackageToApp(tmpDir);
    expect(result.added).toBe(false);
    expect(result.message).toBe('package.json invalid');
  });

  it('devDependencies에 추가하고 added: true', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { 'react-native': '0.83.0' } })
    );
    const result = addPackageToApp(tmpDir);
    expect(result.added).toBe(true);
    expect(result.message).toBe('added to devDependencies');

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.devDependencies['@ohah/react-native-mcp-server']).toMatch(/^\^0\.\d+\.\d+/);
  });

  it('이미 devDependencies에 있으면 스킵', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'app',
        devDependencies: { '@ohah/react-native-mcp-server': '^0.1.0' },
      })
    );
    const result = addPackageToApp(tmpDir);
    expect(result.added).toBe(false);
    expect(result.message).toBe('already in package.json');
  });

  it('이미 dependencies에 있으면 스킵', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'app',
        dependencies: { '@ohah/react-native-mcp-server': '0.1.0' },
      })
    );
    const result = addPackageToApp(tmpDir);
    expect(result.added).toBe(false);
    expect(result.message).toBe('already in package.json');
  });

  it('기존 devDependencies 유지하면서 추가', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'app',
        devDependencies: { typescript: '^5.0.0' },
      })
    );
    addPackageToApp(tmpDir);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.devDependencies.typescript).toBe('^5.0.0');
    expect(pkg.devDependencies['@ohah/react-native-mcp-server']).toBeDefined();
  });
});

describe('runInstall', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-install-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('npm install 실행 시 ok: true (빈 프로젝트)', () => {
    const result = runInstall(tmpDir, 'npm');
    expect(result.ok).toBe(true);
  });

  it('bun install 실행 시 ok: true', () => {
    const result = runInstall(tmpDir, 'bun');
    expect(result.ok).toBe(true);
  });
});
