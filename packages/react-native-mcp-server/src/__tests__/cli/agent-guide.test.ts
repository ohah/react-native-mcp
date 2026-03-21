/**
 * CLI init-agent 가이드 텍스트 테스트.
 * 마커 존재, 한영 버전 구조, 교체 로직 검증.
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GUIDE_EN, GUIDE_KO, MARKER_START, MARKER_END } from '../../cli/agent-guide.js';

describe('agent-guide', () => {
  it('영어 가이드에 마커 포함', () => {
    expect(GUIDE_EN).toContain(MARKER_START);
    expect(GUIDE_EN).toContain(MARKER_END);
  });

  it('한국어 가이드에 마커 포함', () => {
    expect(GUIDE_KO).toContain(MARKER_START);
    expect(GUIDE_KO).toContain(MARKER_END);
  });

  it('영어 가이드에 필수 명령어 포함', () => {
    expect(GUIDE_EN).toContain('rn-mcp status');
    expect(GUIDE_EN).toContain('rn-mcp snapshot -i');
    expect(GUIDE_EN).toContain('rn-mcp tap');
    expect(GUIDE_EN).toContain('rn-mcp type');
    expect(GUIDE_EN).toContain('rn-mcp assert');
  });

  it('한국어 가이드에 필수 명령어 포함', () => {
    expect(GUIDE_KO).toContain('rn-mcp status');
    expect(GUIDE_KO).toContain('rn-mcp snapshot -i');
    expect(GUIDE_KO).toContain('rn-mcp tap');
  });

  it('영어 가이드에 워크플로우 순서 포함', () => {
    expect(GUIDE_EN).toContain('Check connection');
    expect(GUIDE_EN).toContain('snapshot -i');
    expect(GUIDE_EN).toContain('screen transition');
  });

  it('한국어 가이드에 워크플로우 순서 포함', () => {
    expect(GUIDE_KO).toContain('연결 확인');
    expect(GUIDE_KO).toContain('snapshot -i');
    expect(GUIDE_KO).toContain('화면 전환');
  });
});

describe('init-agent file operations', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('기존 파일에 가이드 추가', () => {
    const filePath = path.join(tmpDir, 'AGENTS.md');
    writeFileSync(filePath, '# My Project\n\nSome content.\n');

    // 가이드 추가
    const content = readFileSync(filePath, 'utf8');
    writeFileSync(filePath, content + '\n' + GUIDE_EN + '\n');

    const result = readFileSync(filePath, 'utf8');
    expect(result).toContain('# My Project');
    expect(result).toContain('Some content.');
    expect(result).toContain(MARKER_START);
    expect(result).toContain('rn-mcp snapshot -i');
    expect(result).toContain(MARKER_END);
  });

  it('기존 가이드 교체', () => {
    const filePath = path.join(tmpDir, 'CLAUDE.md');
    // 영어 가이드가 이미 있는 파일
    writeFileSync(filePath, `# Claude\n\n${GUIDE_EN}\n\n## Other section\n`);

    // 한국어로 교체
    const content = readFileSync(filePath, 'utf8');
    const regex = new RegExp(
      `${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'g'
    );
    const updated = content.replace(regex, GUIDE_KO);
    writeFileSync(filePath, updated);

    const result = readFileSync(filePath, 'utf8');
    expect(result).toContain('# Claude');
    expect(result).toContain('## Other section');
    // 한국어로 교체됨
    expect(result).toContain('연결 확인');
    // 영어 워크플로우는 없어야 함
    expect(result).not.toContain('Check connection');
    // 마커는 한 쌍만
    expect(result.split(MARKER_START).length).toBe(2);
  });
});
