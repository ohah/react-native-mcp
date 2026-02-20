/**
 * Pure logic for CodeLens: whether to show lens for a language. No vscode dependency.
 */

export function shouldProvideLens(languageId: string): boolean {
  return languageId === 'typescriptreact' || languageId === 'javascriptreact';
}
