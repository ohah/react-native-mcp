import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

const SCROLL_BUTTON_COUNT = 30;

export function StepScrollNoRef({ isDarkMode }: StepProps) {
  const [taps, setTaps] = React.useState<number[]>(() => Array(SCROLL_BUTTON_COUNT).fill(0));
  const tap = (i: number) =>
    setTaps((prev) => {
      const next = [...prev];
      next[i] += 1;
      return next;
    });
  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
        ScrollView (testID, ref 없음)
      </Text>
      <ScrollView
        style={styles.scrollBlock}
        contentContainerStyle={styles.scrollBlockContent}
        testID="scroll-view-no-ref"
      >
        {Array.from({ length: SCROLL_BUTTON_COUNT }, (_, i) => i).map((i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => tap(i)}
            testID={`scroll-btn-${i}`}
          >
            <Text style={styles.buttonText}>
              버튼 {i} ({taps[i]})
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  textDark: { color: '#fff' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#333' },
  scrollBlock: { flex: 1, minHeight: 0 },
  scrollBlockContent: { paddingVertical: 8, paddingBottom: 24, alignItems: 'center' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
