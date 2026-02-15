import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepPressNoTestId({ isDarkMode }: StepProps) {
  const [count, setCount] = React.useState(0);
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => setCount((n) => n + 1)}
        >
          <Text style={styles.buttonText}>testID 없음 ({count})</Text>
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
    backgroundColor: '#884',
    borderRadius: 8,
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
