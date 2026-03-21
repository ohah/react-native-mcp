/**
 * CLI 세션 파일 관리.
 * ~/.rn-mcp/session.json에 refs 매핑과 디바이스 정보 저장.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export interface RefInfo {
  uid: string;
  type: string;
  testID?: string;
  text?: string;
}

export interface Session {
  port: number;
  deviceId?: string;
  platform?: string;
  refs: Record<string, RefInfo>;
  updatedAt: string;
}

const SESSION_DIR = path.join(homedir(), '.rn-mcp');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

export function loadSession(): Session | null {
  try {
    const data = readFileSync(SESSION_FILE, 'utf8');
    return JSON.parse(data) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  mkdirSync(SESSION_DIR, { recursive: true });
  session.updatedAt = new Date().toISOString();
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

/**
 * @ref → RefInfo 해석. 없으면 에러.
 */
export function resolveRef(session: Session, ref: string): RefInfo {
  const info = session.refs[ref];
  if (!info) {
    throw new Error(`${ref} not found. Run \`rn-mcp snapshot -i\` to refresh refs.`);
  }
  return info;
}
