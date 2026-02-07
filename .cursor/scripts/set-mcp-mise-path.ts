/**
 * 사용자 mise 경로로 MCP command 설정
 *
 * 레포 루트에서 실행: bun run .cursor/scripts/set-mcp-mise-path.ts
 * macOS, Linux, Windows에서 동작합니다.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const MCP_JSON_PATH = path.join(process.cwd(), '.cursor', 'mcp.json');

function findMisePath(): string | null {
  // 먼저 "mise which mise"를 shell 없이 시도 (PATH에 mise가 있으면 경로를 직접 반환)
  const which = spawnSync('mise', ['which', 'mise'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: process.env.PATH ?? '' },
  });
  if (which.status === 0 && which.stdout?.trim()) {
    const out = which.stdout.trim();
    const line = out.split('\n')[0]?.trim();
    if (line && (path.isAbsolute(line) || line.includes('mise'))) {
      return line;
    }
  }

  // 폴백: 일반적인 설치 위치
  const home = os.homedir();
  const platform = os.platform();

  const candidates: string[] =
    platform === 'win32'
      ? [
          path.join(home, '.local', 'bin', 'mise.exe'),
          path.join(home, '.local', 'bin', 'mise.cmd'),
          path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'mise', 'mise.exe'),
          path.join(home, 'AppData', 'Local', 'Programs', 'mise', 'mise.exe'),
        ]
      : [path.join(home, '.local', 'bin', 'mise'), '/opt/homebrew/bin/mise', '/usr/local/bin/mise'];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // 건너뜀
    }
  }

  return null;
}

function main(): void {
  const misePath = findMisePath();
  if (!misePath) {
    console.error(
      'mise를 찾을 수 없습니다. mise (https://mise.jdx.dev/)를 설치하고 레포 루트에서 다시 실행하세요.'
    );
    process.exit(1);
  }

  let mcp: { mcpServers?: Record<string, { command?: string; args?: string[] }> };
  try {
    const raw = fs.readFileSync(MCP_JSON_PATH, 'utf8');
    mcp = JSON.parse(raw) as typeof mcp;
  } catch (e) {
    console.error('.cursor/mcp.json 읽기 실패:', e);
    process.exit(1);
  }

  if (!mcp.mcpServers) {
    console.error('.cursor/mcp.json에 mcpServers가 없습니다.');
    process.exit(1);
  }

  let updated = 0;
  for (const key of Object.keys(mcp.mcpServers)) {
    const server = mcp.mcpServers[key];
    if (server && typeof server.command === 'string') {
      server.command = misePath;
      updated += 1;
    }
  }

  try {
    fs.writeFileSync(MCP_JSON_PATH, JSON.stringify(mcp, null, 2) + '\n', 'utf8');
  } catch (e) {
    console.error('.cursor/mcp.json 쓰기 실패:', e);
    process.exit(1);
  }

  console.log(`${updated}개의 MCP 서버를 업데이트했습니다: ${misePath}`);
}

main();
