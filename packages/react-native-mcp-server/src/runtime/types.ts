/** React Fiber node (internal structure) */
export interface Fiber {
  type: any;
  tag: number;
  memoizedProps: Record<string, any> | null;
  memoizedState: any;
  child: Fiber | null;
  sibling: Fiber | null;
  return: Fiber | null;
  stateNode: any;
  alternate: Fiber | null;
  dependencies: { firstContext: any } | null;
}

/** DevTools hook installed on globalThis */
export interface DevToolsHook {
  supportsFiber: boolean;
  renderers: Map<number, any>;
  inject: (internals: any) => number;
  onCommitFiberRoot: (rendererID: number, root: any) => void;
  onCommitFiberUnmount: () => void;
  getFiberRoots: (rendererID: number) => Set<any>;
}

export interface ConsoleLogEntry {
  id: number;
  message: string;
  level: number;
  timestamp: number;
}

export interface NetworkEntry {
  id: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  status: number | null;
  statusText: string | null;
  responseHeaders: string | null;
  responseBody: string | null;
  startTime: number;
  duration: number | null;
  error: string | null;
  state: string;
  /** true when the response was returned by a network mock rule */
  mocked?: boolean;
}

export interface StateChangeEntry {
  id: number;
  timestamp: number;
  component: string;
  hookIndex: number;
  prev: any;
  next: any;
  /** 소스맵 추론용. fiber._debugStack에서 추출한 (bundleUrl, line, column) 목록 */
  sourceRef?: Array<{ bundleUrl: string; line: number; column: number }>;
}

export interface RenderEntry {
  component: string;
  nativeType?: string;
  type: 'mount' | 'update';
  trigger: 'state' | 'props' | 'context' | 'parent';
  timestamp: number;
  commitId: number;
  parent: string;
  isMemoized: boolean;
  changes?: {
    props?: { key: string; prev: any; next: any }[];
    state?: { hookIndex: number; prev: any; next: any }[];
    context?: { name: string; prev: any; next: any }[];
  };
}

export interface MeasureResult {
  x: number;
  y: number;
  width: number;
  height: number;
  pageX: number;
  pageY: number;
}
