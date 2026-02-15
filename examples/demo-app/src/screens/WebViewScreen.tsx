/**
 * WebView 탭 — MCP webview_evaluate_script 또는 query_selector로 WebView 영역 좌표 획득 후 tap(idb/adb) 테스트용
 * Babel이 testID 있는 WebView에 onMessage를 자동 주입(createWebViewOnMessage 래핑)하므로
 * 앱에서는 사용자 postMessage 처리만 작성하면 됨.
 */

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
    h1 { font-size: 18px; }
    button { padding: 12px 20px; font-size: 16px; margin: 8px 0; }
    #webview-demo-btn { background: #0066cc; color: #fff; border: none; border-radius: 8px; }
    #webview-demo-btn:active { opacity: 0.9; }
    .count { font-weight: 600; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>WebView 탭 (MCP 테스트)</h1>
  <p>아래 버튼은 webview_evaluate_script 또는 idb/adb tap(좌표)으로 클릭할 수 있습니다.</p>
  <button id="webview-demo-btn" onclick="window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'tap' })); document.getElementById('count').textContent = (parseInt(document.getElementById('count').textContent) + 1);">
    WebView 내부 버튼
  </button>
  <p class="count">탭 수: <span id="count">0</span></p>
</body>
</html>
`;

export type WebViewScreenProps = {
  isDarkMode: boolean;
};

export function WebViewScreen({ isDarkMode }: WebViewScreenProps) {
  const [postMessageTapCount, setPostMessageTapCount] = React.useState(0);

  const handleWebViewMessage = React.useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { type?: string };
      if (data.type === 'tap') setPostMessageTapCount((c) => c + 1);
    } catch {
      // ignore parse error
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDarkMode && styles.textDark]} testID="demo-app-webview-title">
        WebView
      </Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
        MCP webview_evaluate_script 또는 query_selector → tap(idb/adb) 테스트
      </Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          인라인 HTML (postMessage)
        </Text>
        <Text style={[styles.hint, isDarkMode && styles.textDark]}>
          RN이 받은 탭 수: {postMessageTapCount} — 버튼 클릭 시 증가 (MCP eval 결과는 서버로만 반환)
        </Text>
        <WebView
          source={{ html: HTML }}
          style={styles.webview}
          testID="demo-app-webview"
          originWhitelist={['*']}
          onMessage={handleWebViewMessage}
        />
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>네이버 검색</Text>
        <WebView
          source={{ uri: 'https://search.naver.com' }}
          style={styles.webview}
          testID="demo-app-webview-naver"
          onMessage={handleWebViewMessage}
        />
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          testID 없는 WebView (MCP 미등록)
        </Text>
        <WebView
          source={{
            html: '<html><body style="font-family:system-ui;padding:16px"><h2>testID 없음</h2><p>getRegisteredWebViewIds에 포함되지 않음</p></body></html>',
          }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: '#000' },
  textDark: { color: '#fff' },
  subtitle: { fontSize: 13, marginBottom: 12, color: '#333' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  hint: { fontSize: 12, marginBottom: 8, color: '#666' },
  webview: { height: 220, marginBottom: 8 },
});
