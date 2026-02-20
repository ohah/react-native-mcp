/**
 * E2E Dashboard HTML generation. No vscode dependency.
 * Used by E2eDashboardPanel and by unit tests.
 */

export function getDashboardHtml(dashboardUrl: string, _cspSource: string): string {
  const origin = dashboardUrl.replace(/\/$/, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; frame-src ${origin};">
  <title>E2E Dashboard</title>
  <style>
    body { margin: 0; padding: 0; height: 100vh; }
    iframe { width: 100%; height: 100%; border: none; }
    .hint { padding: 8px 12px; font-size: 12px; background: var(--vscode-editor-inactiveSelectionBackground); }
  </style>
</head>
<body>
  <div class="hint">Dashboard: ${dashboardUrl} — Run <code>bun run dashboard:show</code> if not loading.</div>
  <iframe src="${dashboardUrl}" title="E2E Dashboard"></iframe>
</body>
</html>`;
}
