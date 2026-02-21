import React from 'react';
import { StyleSheet, Text, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';

const HTML = `
<!DOCTYPE html>
<html><body style="font-family:system-ui;padding:16px">
<h2>postMessage 테스트</h2>
<p>아래 버튼을 tap하면 RN으로 postMessage가 전송됩니다.</p>
<button id="postmsg-btn" style="padding:8px 16px;font-size:16px">postMessage 보내기</button>
<script>
document.getElementById('postmsg-btn').onclick = function() {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'postMessage-test' }));
  }
};
</script>
</body></html>
`;

export type StepProps = { isDarkMode: boolean };

export function StepWebViewNoTestId({ isDarkMode }: StepProps) {
  const [postMessageCount, setPostMessageCount] = React.useState(0);
  const handleMessage = React.useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data?.type === 'postMessage-test') setPostMessageCount((c) => c + 1);
    } catch {}
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.hint, isDarkMode && styles.textDark]}>
        testID 없는 WebView — 버튼 tap 후 postMessage 수신 확인
      </Text>
      <Text style={[styles.count, isDarkMode && styles.textDark]} testID="postmessage-count">
        postMessage 수: {postMessageCount}
      </Text>
      <WebView source={{ html: HTML }} style={styles.webview} onMessage={handleMessage} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  hint: { fontSize: 12, marginBottom: 8, color: '#666' },
  textDark: { color: '#fff' },
  count: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  webview: { minHeight: 320 },
});
