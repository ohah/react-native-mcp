/**
 * TreeDataProvider for the Component Tree sidebar.
 * Calls take_snapshot eval to get the React Fiber component tree,
 * then presents it as a VS Code tree view.
 */

import * as vscode from 'vscode';
import type { WsClient } from '../ws-client';

interface ComponentNode {
  type: string;
  uid?: string;
  testID?: string;
  text?: string;
  children?: ComponentNode[];
}

/** 내부 성능 측정용 컴포넌트 — 트리에 노출하지 않음 */
const HIDDEN_COMPONENT_TYPES = new Set(['RenderOverlay', 'MCPRoot']);

function filterHiddenNodes(nodes: ComponentNode[]): ComponentNode[] {
  const result: ComponentNode[] = [];
  for (const node of nodes) {
    if (HIDDEN_COMPONENT_TYPES.has(node.type)) {
      const children = node.children ?? [];
      result.push(...filterHiddenNodes(children));
    } else {
      const filtered = node.children
        ? { ...node, children: filterHiddenNodes(node.children) }
        : node;
      result.push(filtered);
    }
  }
  return result;
}

class TreeItem extends vscode.TreeItem {
  children?: ComponentNode[];

  constructor(node: ComponentNode) {
    const hasChildren = node.children && node.children.length > 0;
    super(
      TreeItem.makeLabel(node),
      hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    this.children = node.children;
    this.tooltip = node.uid ?? node.type;
    this.description = node.testID ? `#${node.testID}` : undefined;

    // Click → reveal source (Phase 4: source jump)
    if (node.testID) {
      this.command = {
        command: 'rnMcp.revealComponentSource',
        title: 'Go to Source',
        arguments: [node.testID],
      };
    }

    // Icon based on component type
    if (node.type === 'Text' || node.type === 'RCTText') {
      this.iconPath = new vscode.ThemeIcon('symbol-string');
    } else if (node.type === 'View' || node.type === 'RCTView') {
      this.iconPath = new vscode.ThemeIcon('symbol-namespace');
    } else if (node.type === 'ScrollView' || node.type === 'RCTScrollView') {
      this.iconPath = new vscode.ThemeIcon('symbol-array');
    } else if (node.type === 'Image' || node.type === 'RCTImageView') {
      this.iconPath = new vscode.ThemeIcon('file-media');
    } else if (node.type === 'TextInput' || node.type === 'RCTTextInput') {
      this.iconPath = new vscode.ThemeIcon('symbol-field');
    } else if (node.type === 'Pressable' || node.type === 'TouchableOpacity') {
      this.iconPath = new vscode.ThemeIcon('symbol-event');
    } else {
      this.iconPath = new vscode.ThemeIcon('symbol-class');
    }
  }

  static makeLabel(node: ComponentNode): string {
    let label = node.type;
    if (node.text) {
      const truncated = node.text.length > 40 ? node.text.slice(0, 40) + '...' : node.text;
      label += ` "${truncated}"`;
    }
    return label;
  }
}

export class ComponentTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private client: WsClient;
  private rootNodes: ComponentNode[] = [];

  constructor(client: WsClient) {
    this.client = client;

    // Auto-load tree when devices connect/disconnect or selection changes
    client.on('devices-changed', () => this.fetchTree());
    client.on('selected-device-changed', () => this.fetchTree());
  }

  refresh(): void {
    this.fetchTree();
  }

  private async fetchTree(): Promise<void> {
    if (!this.client.connected || this.client.devices.length === 0) {
      this.rootNodes = [];
      this._onDidChangeTreeData.fire(undefined);
      return;
    }

    try {
      const deviceId = this.client.selectedDeviceId ?? undefined;
      const result = await this.client.getComponentTree({ maxDepth: 30 }, deviceId);
      if (result && typeof result === 'object') {
        const root = result as ComponentNode;
        const raw = root.children ?? [root];
        this.rootNodes = filterHiddenNodes(raw);
      } else {
        this.rootNodes = [];
      }
    } catch {
      this.rootNodes = [];
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      // Root level
      if (!this.client.connected || this.client.devices.length === 0) {
        return [new PlaceholderItem()];
      }
      if (this.rootNodes.length === 0) {
        return [new PlaceholderItem('Click refresh to load tree')];
      }
      return this.rootNodes.map((n) => new TreeItem(n));
    }

    // Children of expanded node
    return (element.children ?? []).map((n) => new TreeItem(n));
  }
}

class PlaceholderItem extends vscode.TreeItem {
  constructor(message?: string) {
    super(message ?? 'Not connected', vscode.TreeItemCollapsibleState.None);
    this.description = message ? undefined : 'Start MCP server & app';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}
