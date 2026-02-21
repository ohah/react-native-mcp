/**
 * start_video_recording / stop_video_recording 도구: path 검증, no active recording 반환 검증
 * (실제 idb/adb spawn은 하지 않음)
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import {
  registerStartVideoRecording,
  registerStopVideoRecording,
  stopAllRecordings,
} from '../tools/video-recording.js';

type ToolHandler = (args: unknown) => Promise<unknown>;

function createMockServer(): {
  handlers: Map<string, ToolHandler>;
  registerTool: (name: string, _def: unknown, handler: (args: unknown) => Promise<unknown>) => void;
} {
  const handlers = new Map<string, ToolHandler>();
  return {
    handlers,
    registerTool(name: string, _def: unknown, handler: ToolHandler) {
      handlers.set(name, handler);
    },
  };
}

describe('video-recording tools', () => {
  let startHandler: ToolHandler;
  let stopHandler: ToolHandler;

  beforeEach(() => {
    stopAllRecordings();
    const server = createMockServer();
    registerStartVideoRecording(server as never);
    registerStopVideoRecording(server as never);
    startHandler = server.handlers.get('start_video_recording')!;
    stopHandler = server.handlers.get('stop_video_recording')!;
  });

  describe('start_video_recording', () => {
    it('filePath가 cwd 밖이면 isError 반환', async () => {
      const result = (await startHandler({
        platform: 'ios',
        filePath: '/tmp/outside-cwd-recording.mp4',
      })) as { isError?: boolean; content?: Array<{ type: string; text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(0);
      expect(result.content![0].type).toBe('text');
      expect(result.content![0].text).toContain('filePath must be under current working directory');
    });
  });

  describe('stop_video_recording', () => {
    it('활성 녹화 없을 때 No active recording 반환', async () => {
      const result = (await stopHandler({})) as {
        content?: Array<{ type: string; text: string }>;
      };
      expect(result.content).toHaveLength(1);
      const text = result.content![0].text;
      const parsed = JSON.parse(text) as { success: boolean; error?: string };
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('No active recording.');
    });
  });
});
