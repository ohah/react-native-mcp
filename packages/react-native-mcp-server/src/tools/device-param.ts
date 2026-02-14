/**
 * 다중 디바이스 라우팅용 공통 파라미터 (deviceId, platform)
 */

import { z } from 'zod';

export const deviceParam = z
  .string()
  .optional()
  .describe(
    'Target device ID (e.g. "ios-1", "android-1"). Run get_debugger_status to see connected devices.'
  );

export const platformParam = z
  .enum(['ios', 'android'])
  .optional()
  .describe('Target platform. Works when only one device of this platform is connected.');
