import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepPressLongPress({ isDarkMode: _isDarkMode }: StepProps) {
  const [longPressCount, setLongPressCount] = React.useState(0);
  const [longPressNoIdCount, setLongPressNoIdCount] = React.useState(0);
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onLongPress={() => setLongPressCount((n) => n + 1)}
          testID="press-long-press-button"
        >
          <Text style={styles.buttonText}>Long Press ({longPressCount})</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onLongPress={() => setLongPressNoIdCount((n) => n + 1)}
        >
          <Text style={styles.buttonText}>롱프레스 testID없음 ({longPressNoIdCount})</Text>
        </Pressable>
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
    backgroundColor: '#864',
    borderRadius: 8,
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
