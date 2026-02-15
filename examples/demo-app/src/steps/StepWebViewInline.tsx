import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';

const HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui; padding: 16px; }
    button { padding: 12px 20px; font-size: 16px; margin: 8px 0;
      background: #0066cc; color: #fff; border: none; border-radius: 8px; }
    .count { font-weight: 600; margin-top: 12px; }
  </style>
</head>
<body>
  <p>아래 버튼을 클릭하세요.</p>
  <button id="webview-demo-btn" onclick="window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'tap' })); document.getElementById('count').textContent = (parseInt(document.getElementById('count').textContent) + 1);">
    WebView 내부 버튼
  </button>
  <p class="count">탭 수: <span id="count">0</span></p>
</body>
</html>
`;

export type StepProps = { isDarkMode: boolean };

export function StepWebViewInline({ isDarkMode }: StepProps) {
  const [tapCount, setTapCount] = React.useState(0);
  const handleMessage = React.useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { type?: string };
      if (data.type === 'tap') setTapCount((c) => c + 1);
    } catch {
      // ignore
    }
  }, []);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.hint, isDarkMode && styles.textDark]}>RN 탭 수: {tapCount}</Text>
      <WebView
        source={{ html: HTML }}
        style={styles.webview}
        testID="demo-app-webview"
        originWhitelist={['*']}
        onMessage={handleMessage}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  hint: { fontSize: 12, marginBottom: 8, color: '#666' },
  textDark: { color: '#fff' },
  webview: { minHeight: 320 },
});
