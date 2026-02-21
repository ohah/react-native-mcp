/**
 * React Native MCP Doctor (doctor.mjs) 스크립트 검증.
 * 서브프로세스로 실행해 출력·exit code를 검사한다.
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'doctor.mjs');

function runDoctor(cwd: string): { stdout: string; stderr: string; status: number | null } {
  const r = spawnSync('node', [SCRIPT_PATH], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
  });
  return {
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    status: r.status,
  };
}

describe('doctor', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-doctor-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('package.json 없으면 스크립트가 실행되고 Common·React Native·E2E 섹션 출력', () => {
    const { stdout, status } = runDoctor(tmpDir);
    expect(stdout).toContain('Common');
    expect(stdout).toContain('React Native');
    expect(stdout).toContain('E2E (optional)');
    expect(stdout).toContain('---');
    expect(stdout).toContain('react-native - Not in this project (skipped)');
    // Node 버전에 따라 exit 0 또는 1 (Node >= 24 이면 0)
    expect([0, 1]).toContain(status);
  });

  it('react-native 0.74 이상이면 필수 검사 통과 (Node >= 24 환경 가정)', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.1' } })
    );
    const { stdout, status } = runDoctor(tmpDir);
    expect(stdout).toContain(' ✓ react-native 0.83.1');
    expect(stdout).toContain('---');
    if (status === 0) {
      expect(stdout).toContain('All required checks passed.');
    }
  });

  it('react-native 0.73 이하면 exit 1이고 실패 메시지 포함', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.73.6' } })
    );
    const { stdout, status } = runDoctor(tmpDir);
    expect(status).toBe(1);
    expect(stdout).toContain(' ✗ react-native');
    expect(stdout).toContain('0.73');
    expect(stdout).toContain('Required >= 0.74.0');
    expect(stdout).toContain('required check(s) failed');
  });

  it('react-native 0.74.0이면 통과로 처리', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.74.0' } })
    );
    const { stdout, status } = runDoctor(tmpDir);
    expect(stdout).toContain(' ✓ react-native 0.74.0');
    if (status === 0) {
      expect(stdout).toContain('All required checks passed.');
    }
  });

  it('metro.config.js 있으면 해당 라인에 ✓ 표시', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'metro.config.js'), 'module.exports = {};');
    const { stdout } = runDoctor(tmpDir);
    expect(stdout).toContain(' ✓ metro.config.js found');
  });

  it('metro.config.ts 있어도 metro 존재로 인식', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { 'react-native': '0.83.0' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'metro.config.ts'), 'export default {};');
    const { stdout } = runDoctor(tmpDir);
    expect(stdout).toContain(' ✓ metro.config.js found');
  });

  it('devDependencies에 react-native 있어도 버전 검사', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { 'react-native': '0.72.0' } })
    );
    const { stdout, status } = runDoctor(tmpDir);
    expect(status).toBe(1);
    expect(stdout).toContain(' ✗ react-native 0.72.0');
  });
});
