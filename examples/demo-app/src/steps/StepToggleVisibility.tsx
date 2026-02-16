import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepToggleVisibility({ isDarkMode }: StepProps) {
  const [visible, setVisible] = React.useState(true);
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        testID="toggle-visibility-scroll"
      >
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => setVisible((v) => !v)}
          testID="toggle-visibility-btn"
        >
          <Text style={styles.buttonText}>{visible ? '숨기기' : '보이기'}</Text>
        </Pressable>

        {visible && (
          <View testID="toggle-target" style={styles.target}>
            <Text style={[styles.targetText, isDarkMode && styles.darkText]}>
              이 요소가 보입니다
            </Text>
          </View>
        )}

        <Text style={[styles.status, isDarkMode && styles.darkText]}>
          상태: {visible ? '표시됨' : '숨겨짐'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8, paddingBottom: 24, alignItems: 'center' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  target: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  targetText: { fontSize: 14, color: '#2e7d32' },
  status: { marginTop: 12, fontSize: 14, color: '#333' },
  darkText: { color: '#ccc' },
});
