/**
 * Routes messages from Webview → Extension Host → WsClient.
 * Each message has { type, id, payload }. Response is { type: 'response', id, result/error }.
 */

import type { WsClient } from '../ws-client';

interface WebviewMessage {
  type: string;
  id: string;
  payload?: Record<string, unknown>;
}

interface WebviewResponse {
  type: 'response';
  id: string;
  result?: unknown;
  error?: string;
}

type Handler = (msg: WebviewMessage) => Promise<WebviewResponse | null>;

export function createMessageHandler(client: WsClient): Handler {
  return async (msg: WebviewMessage): Promise<WebviewResponse | null> => {
    const { type, id, payload } = msg;
    if (!id) return null;

    try {
      let result: unknown;

      switch (type) {
        case 'getConsoleLogs':
          result = await client.getConsoleLogs(
            payload as { level?: string; since?: number; limit?: number } | undefined,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'clearConsoleLogs':
          await client.clearConsoleLogs(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          result = true;
          break;

        case 'getNetworkRequests':
          result = await client.getNetworkRequests(
            payload as
              | { url?: string; method?: string; status?: number; since?: number; limit?: number }
              | undefined,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'clearNetworkRequests':
          await client.clearNetworkRequests(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          result = true;
          break;

        case 'listNetworkMocks':
          result = await client.listNetworkMocks(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'setNetworkMock':
          result = await client.setNetworkMock(
            payload as {
              urlPattern: string;
              isRegex?: boolean;
              method?: string;
              status?: number;
              statusText?: string;
              headers?: Record<string, string>;
              body?: string;
              delay?: number;
            },
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'removeNetworkMock':
          result = await client.removeNetworkMock(
            (payload?.id as number) ?? 0,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'clearNetworkMocks':
          await client.clearNetworkMocks(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          result = true;
          break;

        case 'getStateChanges':
          result = await client.getStateChanges(
            payload as { component?: string; since?: number; limit?: number } | undefined,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'clearStateChanges':
          await client.clearStateChanges(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          result = true;
          break;

        case 'getRenderReport':
          result = await client.getRenderReport(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'startRenderProfile':
          result = await client.startRenderProfile(
            payload as { components?: string[]; ignore?: string[] } | undefined,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'clearRenderProfile':
          await client.clearRenderProfile(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          result = true;
          break;

        case 'startRenderHighlight':
          result = await client.startRenderHighlight(
            payload as
              | {
                  components?: string[];
                  ignore?: string[];
                  showLabels?: boolean;
                  fadeTimeout?: number;
                  maxHighlights?: number;
                }
              | undefined,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'stopRenderHighlight':
          await client.stopRenderHighlight(
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          result = true;
          break;

        case 'getComponentTree':
          result = await client.getComponentTree(
            payload as { maxDepth?: number } | undefined,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'getAccessibilityAudit':
          result = await client.getAccessibilityAudit(
            payload as { maxDepth?: number } | undefined,
            payload?.deviceId as string | undefined,
            payload?.platform as string | undefined
          );
          break;

        case 'getDevices':
          result = await client.getDevices();
          break;

        case 'getConnectionStatus':
          result = {
            connected: client.connected,
            devices: client.devices,
            selectedDeviceId: client.selectedDeviceId,
          };
          break;

        case 'selectDevice':
          client.selectDevice((payload?.deviceId as string) ?? null);
          result = { selectedDeviceId: client.selectedDeviceId };
          break;

        case 'reconnect':
          client.reconnect();
          result = true;
          break;

        default:
          return { type: 'response', id, error: `Unknown message type: ${type}` };
      }

      return { type: 'response', id, result };
    } catch (err) {
      return {
        type: 'response',
        id,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}
