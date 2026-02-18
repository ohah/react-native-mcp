import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setupMcpConfig } from '../init/mcp-config.js';
import * as childProcess from 'node:child_process';

describe('setupMcpConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mcp-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('cursor', () => {
    it('.cursor/mcp.json 생성', () => {
      const result = setupMcpConfig('cursor', tmpDir);
      expect(result.success).toBe(true);

      const configPath = path.join(tmpDir, '.cursor', 'mcp.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.mcpServers['react-native-mcp']).toEqual({
        command: 'npx',
        args: ['-y', '@ohah/react-native-mcp-server'],
      });
    });

    it('기존 설정에 merge', () => {
      const cursorDir = path.join(tmpDir, '.cursor');
      fs.mkdirSync(cursorDir, { recursive: true });
      fs.writeFileSync(
        path.join(cursorDir, 'mcp.json'),
        JSON.stringify({
          mcpServers: { 'other-server': { command: 'other' } },
        })
      );

      setupMcpConfig('cursor', tmpDir);

      const config = JSON.parse(fs.readFileSync(path.join(cursorDir, 'mcp.json'), 'utf-8'));
      expect(config.mcpServers['other-server']).toEqual({ command: 'other' });
      expect(config.mcpServers['react-native-mcp']).toBeDefined();
    });

    it('이미 설정되어 있으면 already configured', () => {
      setupMcpConfig('cursor', tmpDir);
      const result = setupMcpConfig('cursor', tmpDir);
      expect(result.success).toBe(true);
      expect(result.message).toBe('already configured');
    });

    it('파손된 JSON이면 덮어쓰기', () => {
      const cursorDir = path.join(tmpDir, '.cursor');
      fs.mkdirSync(cursorDir);
      fs.writeFileSync(path.join(cursorDir, 'mcp.json'), '{invalid json!!');

      const result = setupMcpConfig('cursor', tmpDir);
      expect(result.success).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(cursorDir, 'mcp.json'), 'utf-8'));
      expect(config.mcpServers['react-native-mcp']).toBeDefined();
    });
  });

  describe('claude-code', () => {
    it('execSync 성공 시 success 반환', () => {
      const originalExecSync = childProcess.execSync;
      mock.module('node:child_process', () => ({
        ...childProcess,
        execSync: mock(() => Buffer.from('')),
      }));

      // re-import to pick up mock
      const { setupMcpConfig: setup } = require('../init/mcp-config.js');
      const result = setup('claude-code', tmpDir);
      expect(result.success).toBe(true);
      expect(result.message).toBe('added via claude mcp add');

      // restore
      mock.module('node:child_process', () => ({
        ...childProcess,
        execSync: originalExecSync,
      }));
    });

    it('execSync 실패 시 에러 메시지 반환', () => {
      const originalExecSync = childProcess.execSync;
      mock.module('node:child_process', () => ({
        ...childProcess,
        execSync: mock(() => {
          throw new Error('command not found: claude');
        }),
      }));

      const { setupMcpConfig: setup } = require('../init/mcp-config.js');
      const result = setup('claude-code', tmpDir);
      expect(result.success).toBe(false);
      expect(result.message).toContain('claude mcp add failed');
      expect(result.message).toContain('Run manually');

      // restore
      mock.module('node:child_process', () => ({
        ...childProcess,
        execSync: originalExecSync,
      }));
    });
  });
});
