/**
 * CLI --help / --version 출력 테스트.
 * 빌드된 dist/cli.js가 정상 동작하는지 smoke test.
 */
import { describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const CLI_PATH = path.resolve(import.meta.dirname, '../../../dist/cli.js');

function runCli(args: string[]): string {
  return execFileSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
    timeout: 10000,
  });
}

describe('CLI smoke tests', () => {
  it('--help 출력에 필수 섹션 포함', () => {
    const output = runCli(['--help']);
    expect(output).toContain('rn-mcp');
    expect(output).toContain('USAGE');
    expect(output).toContain('WORKFLOW');
    expect(output).toContain('COMMANDS');
    expect(output).toContain('snapshot');
    expect(output).toContain('tap');
    expect(output).toContain('type');
    expect(output).toContain('assert');
    expect(output).toContain('REFS SYSTEM');
    expect(output).toContain('EXAMPLES');
    expect(output).toContain('init-agent');
  });

  it('--help에 iOS orientation 자동 처리 안내', () => {
    const output = runCli(['--help']);
    expect(output).toContain('iOS');
    expect(output).toContain('orientation');
  });

  it('--help에 @ref 설명', () => {
    const output = runCli(['--help']);
    expect(output).toContain('@e1');
    expect(output).toContain('@e2');
    expect(output).toContain('session.json');
  });

  it('--version 출력', () => {
    const output = runCli(['--version']);
    expect(output.trim()).toMatch(/^rn-mcp v\d+\.\d+\.\d+/);
  });

  it('인자 없으면 help 출력', () => {
    const output = runCli([]);
    expect(output).toContain('USAGE');
  });

  it('잘못된 명령 → exit code 1', () => {
    try {
      runCli(['nonexistent-command']);
      expect(true).toBe(false); // should not reach
    } catch (err: any) {
      expect(err.status).toBe(1);
      expect(err.stderr.toString()).toContain('Unknown command');
    }
  });
});
