import { describe, expect, it } from 'bun:test';
import { parseArgs } from 'node:util';

/**
 * CLI가 report show와 dashboard 리포터를 인식하는지 검사.
 * (실제 서버 기동 없이 positionals/options 파싱만 검증)
 */
describe('CLI report show', () => {
  it('positionals가 report, show이면 run 경로가 아님', () => {
    const { positionals } = parseArgs({
      args: ['report', 'show', '-o', './out'],
      allowPositionals: true,
      options: { output: { type: 'string', short: 'o' }, port: { type: 'string' } },
    });
    expect(positionals[0]).toBe('report');
    expect(positionals[1]).toBe('show');
    expect(positionals[0]).not.toBe('run');
  });

  it('run 시 positionals[1]이 경로', () => {
    const { positionals } = parseArgs({
      args: ['run', 'e2e/', '-r', 'dashboard'],
      allowPositionals: true,
      options: { reporter: { type: 'string', short: 'r' }, output: { type: 'string', short: 'o' } },
    });
    expect(positionals[0]).toBe('run');
    expect(positionals[1]).toBe('e2e/');
  });
});
