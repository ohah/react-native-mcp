/**
 * Pure logic for finding source line by testID. No vscode dependency.
 * Used by reveal-component-source.ts and by unit tests.
 */

export interface FileContent {
  uri: string;
  text: string;
}

/**
 * Find first file and line index where testID is used with the given value.
 */
export function findSourceLine(
  identifier: string,
  files: FileContent[]
): { uri: string; lineIndex: number; lineLength: number } | null {
  if (!identifier || typeof identifier !== 'string') return null;

  for (const { uri, text } of files) {
    if (!text.includes(identifier)) continue;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.includes('testID') || !line.includes(identifier)) continue;
      return { uri, lineIndex: i, lineLength: line.length };
    }
  }
  return null;
}
