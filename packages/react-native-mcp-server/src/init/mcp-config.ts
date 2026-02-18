/**
 * MCP 클라이언트 설정 파일 생성/업데이트
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

export type McpClient = 'cursor' | 'claude-code' | 'claude-desktop' | 'windsurf' | 'antigravity';

export const MCP_CLIENTS: { label: string; value: McpClient }[] = [
  { label: 'Cursor', value: 'cursor' },
  { label: 'Claude Code (CLI)', value: 'claude-code' },
  { label: 'Claude Desktop', value: 'claude-desktop' },
  { label: 'Windsurf', value: 'windsurf' },
  { label: 'Antigravity', value: 'antigravity' },
];

const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', '@ohah/react-native-mcp-server'],
};

export interface McpConfigResult {
  success: boolean;
  message: string;
}

export function setupMcpConfig(client: McpClient, cwd: string): McpConfigResult {
  switch (client) {
    case 'cursor':
      return writeJsonConfig(path.join(cwd, '.cursor', 'mcp.json'));
    case 'windsurf':
      return writeJsonConfig(path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'));
    case 'antigravity':
      return writeJsonConfig(path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'));
    case 'claude-desktop':
      return writeClaudeDesktopConfig();
    case 'claude-code':
      return runClaudeCodeAdd();
  }
}

function writeJsonConfig(configPath: string): McpConfigResult {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      // 파손된 JSON — 덮어쓰기
    }
  }

  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};

  if (mcpServers['react-native-mcp']) {
    return { success: true, message: 'already configured' };
  }

  mcpServers['react-native-mcp'] = MCP_SERVER_ENTRY;
  existing.mcpServers = mcpServers;

  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  const relPath = path.relative(process.cwd(), configPath);
  return { success: true, message: `created ${relPath}` };
}

function getClaudeDesktopConfigPath(): string {
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json'
    );
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json');
  }
  // Linux
  return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

function writeClaudeDesktopConfig(): McpConfigResult {
  const configPath = getClaudeDesktopConfigPath();
  return writeJsonConfig(configPath);
}

function runClaudeCodeAdd(): McpConfigResult {
  try {
    execSync('claude mcp add react-native-mcp -- npx -y @ohah/react-native-mcp-server', {
      stdio: 'pipe',
    });
    return { success: true, message: 'added via claude mcp add' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `claude mcp add failed: ${msg}\nRun manually: claude mcp add react-native-mcp -- npx -y @ohah/react-native-mcp-server`,
    };
  }
}
