/**
 * CLI session 테스트.
 * ~/.rn-mcp/session.json 관리 로직 검증.
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// session.ts의 SESSION_DIR을 직접 테스트하기 어려우므로 resolveRef만 단위 테스트
import { resolveRef, type Session } from '../../cli/session.js';

describe('resolveRef', () => {
  const session: Session = {
    port: 12300,
    deviceId: 'ios-1',
    platform: 'ios',
    refs: {
      '@e1': { uid: 'root', type: 'View', testID: 'app-root' },
      '@e2': { uid: 'login-btn', type: 'Pressable', testID: 'login-btn', text: '로그인' },
      '@e3': { uid: '1.0.3', type: 'Pressable', text: '회원가입' },
    },
    updatedAt: '2026-03-21T10:00:00Z',
  };

  it('유효한 ref 반환', () => {
    const ref = resolveRef(session, '@e2');
    expect(ref.uid).toBe('login-btn');
    expect(ref.type).toBe('Pressable');
    expect(ref.testID).toBe('login-btn');
    expect(ref.text).toBe('로그인');
  });

  it('testID 없는 ref도 반환', () => {
    const ref = resolveRef(session, '@e3');
    expect(ref.uid).toBe('1.0.3');
    expect(ref.testID).toBeUndefined();
    expect(ref.text).toBe('회원가입');
  });

  it('존재하지 않는 ref → 에러', () => {
    expect(() => resolveRef(session, '@e99')).toThrow('@e99 not found');
  });

  it('에러 메시지에 snapshot 안내 포함', () => {
    expect(() => resolveRef(session, '@e10')).toThrow('snapshot');
  });
});
