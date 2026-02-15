import React from 'react';
import { StyleSheet, Text, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';

export type StepProps = { isDarkMode: boolean };

export function StepWebViewGoogle({ isDarkMode }: StepProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.hint, isDarkMode && styles.textDark]}>
        https://google.com — webview_evaluate_script 테스트
      </Text>
      <WebView
        source={{ uri: 'https://www.google.com' }}
        style={styles.webview}
        testID="demo-app-webview-google"
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
