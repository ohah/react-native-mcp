/**
 * 다중 디바이스 라우팅용 공통 파라미터 (deviceId, platform)
 */

import { z } from 'zod';

export const deviceParam = z
  .string()
  .optional()
  .describe('Target device ID. Auto if single device. Use get_debugger_status to list.');

export const platformParam = z
  .enum(['ios', 'android'])
  .optional()
  .describe('Target platform. Auto when single device of that platform.');
