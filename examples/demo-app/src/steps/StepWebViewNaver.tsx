import React from 'react';
import { StyleSheet, Text, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';

export type StepProps = { isDarkMode: boolean };

export function StepWebViewNaver({ isDarkMode }: StepProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.hint, isDarkMode && styles.textDark]}>
        네이버 검색 — webview_evaluate_script 테스트
      </Text>
      <WebView
        source={{ uri: 'https://search.naver.com' }}
        style={styles.webview}
        testID="demo-app-webview-naver"
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
