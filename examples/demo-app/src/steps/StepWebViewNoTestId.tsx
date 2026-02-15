import React from 'react';
import { StyleSheet, Text, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';

export type StepProps = { isDarkMode: boolean };

export function StepWebViewNoTestId({ isDarkMode }: StepProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.hint, isDarkMode && styles.textDark]}>
        testID 없는 WebView — getRegisteredWebViewIds에 포함되지 않음
      </Text>
      <WebView
        source={{
          html: '<html><body style="font-family:system-ui;padding:16px"><h2>testID 없음</h2><p>MCP 미등록</p></body></html>',
        }}
        style={styles.webview}
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
