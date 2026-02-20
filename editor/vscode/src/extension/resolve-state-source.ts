/**
 * 상태 변경 entry의 sourceRef를 소스맵으로 해석해 에디터에서 해당 위치를 연다.
 * 워크스페이스 루트에 packages/react-native-mcp-server가 있고 빌드되어 있을 때 동작.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { pathToFileURL } from 'node:url';

export type SourceRef = Array<{ bundleUrl: string; line: number; column: number }>;

export type ResolveResult =
  | { ok: true; filePath: string; lineNumber: number; columnNumber: number }
  | { ok: false; message: string };

export function createResolveSourceRef(
  _context: vscode.ExtensionContext
): (sourceRef: SourceRef) => Promise<ResolveResult> {
  return async (sourceRef: SourceRef): Promise<ResolveResult> => {
    if (!sourceRef || sourceRef.length === 0) {
      return { ok: false, message: 'No sourceRef' };
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return { ok: false, message: 'No workspace folder' };
    }
    const symbolicatePath = path.join(
      workspaceRoot,
      'packages',
      'react-native-mcp-server',
      'dist',
      'symbolicate.js'
    );
    let getSourcePosition: (
      bundleUrl: string,
      line: number,
      column: number,
      opts: { useCache?: boolean }
    ) => Promise<{
      ok: boolean;
      source?: string;
      line?: number | null;
      column?: number | null;
      message?: string;
    }>;
    try {
      const mod = await import(pathToFileURL(symbolicatePath).href);
      getSourcePosition = mod.getSourcePosition ?? mod.default?.getSourcePosition;
    } catch {
      return {
        ok: false,
        message: 'Symbolicate not available (run from repo: bun run build:mcp)',
      };
    }
    const isAppSource = (source: string) =>
      !source.includes('node_modules/react') &&
      !source.includes('node_modules/react-native') &&
      !source.includes('runtime.js');
    for (const ref of sourceRef) {
      const pos = await getSourcePosition(ref.bundleUrl, ref.line, ref.column, { useCache: true });
      if (!pos.ok) continue;
      if (pos.source != null && isAppSource(pos.source)) {
        const filePath = path.isAbsolute(pos.source)
          ? pos.source
          : path.join(workspaceRoot, pos.source);
        const lineNumber = pos.line != null ? pos.line + 1 : 1;
        const columnNumber = pos.column != null ? pos.column + 1 : 1;
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.window.showTextDocument(uri, {
          preserveFocus: false,
          preview: false,
          viewColumn: vscode.ViewColumn.One,
        });
        const line = doc.lineAt(Math.max(0, lineNumber - 1));
        const range = new vscode.Range(line.range.start, line.range.end);
        doc.revealRange(range, vscode.TextEditorRevealType.InCenter);
        return { ok: true, filePath, lineNumber, columnNumber };
      }
    }
    const first = await getSourcePosition(
      sourceRef[0]!.bundleUrl,
      sourceRef[0]!.line,
      sourceRef[0]!.column,
      { useCache: true }
    );
    if (first.ok && first.source != null) {
      const filePath = path.isAbsolute(first.source)
        ? first.source
        : path.join(workspaceRoot, first.source);
      const lineNumber = first.line != null ? first.line + 1 : 1;
      const columnNumber = first.column != null ? first.column + 1 : 1;
      const uri = vscode.Uri.file(filePath);
      await vscode.window.showTextDocument(uri, {
        preserveFocus: false,
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });
      return { ok: true, filePath, lineNumber, columnNumber };
    }
    return { ok: false, message: 'Could not resolve any stack frame' };
  };
}
