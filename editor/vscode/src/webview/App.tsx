import { useState, useReducer, useCallback, createContext, useContext } from 'react';
import { sendRequest, usePushMessages } from './hooks/useExtensionMessage';
import { ConsolePanel } from './panels/ConsolePanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { StatePanel } from './panels/StatePanel';
import { RenderPanel } from './panels/RenderPanel';

// ─── Global state ───

interface DeviceInfo {
  deviceId: string;
  platform: string;
  deviceName: string | null;
}

interface AppState {
  connected: boolean;
  devices: DeviceInfo[];
  selectedDeviceId: string | null;
  /** Incremented on disconnect — panels use this to clear stale data */
  disconnectGeneration: number;
}

type AppAction =
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_DEVICES'; devices: DeviceInfo[] }
  | { type: 'SET_SELECTED_DEVICE'; deviceId: string | null }
  | { type: 'DISCONNECTED' };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };
    case 'SET_DEVICES':
      return { ...state, devices: action.devices };
    case 'SET_SELECTED_DEVICE':
      return { ...state, selectedDeviceId: action.deviceId };
    case 'DISCONNECTED':
      return {
        ...state,
        connected: false,
        devices: [],
        selectedDeviceId: null,
        disconnectGeneration: state.disconnectGeneration + 1,
      };
    default:
      return state;
  }
}

const AppContext = createContext<AppState>({
  connected: false,
  devices: [],
  selectedDeviceId: null,
  disconnectGeneration: 0,
});
export const useAppState = () => useContext(AppContext);

// ─── Tabs ───

const TABS = ['Console', 'Network', 'State', 'Renders'] as const;
type Tab = (typeof TABS)[number];

function DeviceSelector({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}) {
  if (!state.connected || state.devices.length === 0) {
    return null;
  }

  // Resolve the actually active device (explicit selection or first)
  const activeDevice = state.selectedDeviceId
    ? (state.devices.find((d) => d.deviceId === state.selectedDeviceId) ?? state.devices[0]!)
    : state.devices[0]!;

  if (state.devices.length === 1) {
    return (
      <span style={{ fontSize: 11, opacity: 0.7 }}>
        {activeDevice.platform}: {activeDevice.deviceName ?? activeDevice.deviceId}
      </span>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    dispatch({ type: 'SET_SELECTED_DEVICE', deviceId: val });
    sendRequest('selectDevice', { deviceId: val }).catch(() => {});
  };

  return (
    <select
      value={activeDevice.deviceId}
      onChange={handleChange}
      style={{
        padding: '2px 6px',
        fontSize: 11,
        background: 'var(--vscode-dropdown-background)',
        color: 'var(--vscode-dropdown-foreground)',
        border: '1px solid var(--vscode-dropdown-border, #3c3c3c)',
        borderRadius: 2,
      }}
    >
      {state.devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.platform}: {d.deviceName ?? d.deviceId}
        </option>
      ))}
    </select>
  );
}

function DisconnectBanner() {
  const [reconnecting, setReconnecting] = useState(false);

  const handleReconnect = useCallback(() => {
    setReconnecting(true);
    sendRequest('reconnect')
      .catch(() => {})
      .finally(() => {
        setTimeout(() => setReconnecting(false), 2000);
      });
  }, []);

  return (
    <div className="disconnect-banner">
      <span>Not connected to MCP server</span>
      <button onClick={handleReconnect} disabled={reconnecting}>
        {reconnecting ? 'Connecting...' : 'Reconnect'}
      </button>
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>('Console');
  const [state, dispatch] = useReducer(reducer, {
    connected: false,
    devices: [],
    selectedDeviceId: null,
    disconnectGeneration: 0,
  });

  usePushMessages((msg) => {
    if (msg.type === 'connection-status') {
      if (msg.connected) {
        dispatch({ type: 'SET_CONNECTED', connected: true });
      } else {
        dispatch({ type: 'DISCONNECTED' });
      }
    }
    if (msg.type === 'devices-changed') {
      dispatch({ type: 'SET_DEVICES', devices: msg.devices as DeviceInfo[] });
    }
    if (msg.type === 'selected-device-changed') {
      dispatch({ type: 'SET_SELECTED_DEVICE', deviceId: (msg.deviceId as string) ?? null });
    }
  });

  return (
    <AppContext.Provider value={state}>
      {!state.connected && <DisconnectBanner />}
      <div className="tab-bar">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <div
          style={{ marginLeft: 'auto', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
        >
          <DeviceSelector state={state} dispatch={dispatch} />
        </div>
      </div>
      <div className="panel-content">
        <div style={{ display: tab === 'Console' ? 'contents' : 'none' }}>
          <ConsolePanel />
        </div>
        <div style={{ display: tab === 'Network' ? 'contents' : 'none' }}>
          <NetworkPanel />
        </div>
        <div style={{ display: tab === 'State' ? 'contents' : 'none' }}>
          <StatePanel />
        </div>
        <div style={{ display: tab === 'Renders' ? 'contents' : 'none' }}>
          <RenderPanel />
        </div>
      </div>
    </AppContext.Provider>
  );
}
