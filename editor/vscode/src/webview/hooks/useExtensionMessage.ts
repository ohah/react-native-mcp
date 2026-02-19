/**
 * Hook for webview ↔ extension host communication.
 * Sends requests via vscode.postMessage, matches responses by UUID.
 */

import { useCallback, useEffect, useRef } from 'react';

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

type Listener = (msg: MessageEvent) => void;
type PendingResolve = { resolve: (val: unknown) => void; reject: (err: Error) => void };

let reqCounter = 0;
const pendingMap = new Map<string, PendingResolve>();

// Global message listener (set up once)
let listenerInstalled = false;
const pushListeners = new Set<(msg: Record<string, unknown>) => void>();

function ensureListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as Record<string, unknown>;
    if (!msg) return;

    // Response to a request
    if (msg.type === 'response' && typeof msg.id === 'string') {
      const p = pendingMap.get(msg.id);
      if (p) {
        pendingMap.delete(msg.id);
        if (msg.error != null) {
          p.reject(new Error(String(msg.error)));
        } else {
          p.resolve(msg.result);
        }
      }
      return;
    }

    // Push messages (devices-changed, connection-status, etc.)
    for (const fn of pushListeners) {
      fn(msg);
    }
  });
}

/** Send a request to the extension host and await the response. */
export function sendRequest(type: string, payload?: Record<string, unknown>): Promise<unknown> {
  ensureListener();
  const id = `req-${++reqCounter}`;
  return new Promise((resolve, reject) => {
    pendingMap.set(id, { resolve, reject });
    vscode.postMessage({ type, id, payload });
    // Timeout after 15s
    setTimeout(() => {
      if (pendingMap.delete(id)) {
        reject(new Error('Request timeout'));
      }
    }, 15000);
  });
}

/** Hook to listen for server-pushed messages (devices-changed, connection-status). */
export function usePushMessages(handler: (msg: Record<string, unknown>) => void): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    ensureListener();
    const fn = (msg: Record<string, unknown>) => ref.current(msg);
    pushListeners.add(fn);
    return () => {
      pushListeners.delete(fn);
    };
  }, []);
}
