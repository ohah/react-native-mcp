import React from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepGestureRefresh({ isDarkMode }: StepProps) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshCount, setRefreshCount] = React.useState(0);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setRefreshCount((n) => n + 1);
    setTimeout(() => setRefreshing(false), 800);
  }, []);
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.refreshCount, isDarkMode && styles.textDark]}>
          새로고침 횟수: {refreshCount}
        </Text>
        <Text style={[styles.hint, isDarkMode && styles.textDark]}>위에서 당겨 새로고침</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 16 },
  refreshCount: { fontSize: 14, color: '#333' },
  textDark: { color: '#fff' },
  hint: { fontSize: 12, marginTop: 8, color: '#666' },
});
