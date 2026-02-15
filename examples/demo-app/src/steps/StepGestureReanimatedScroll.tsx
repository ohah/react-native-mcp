import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

export type StepProps = { isDarkMode: boolean };

export function StepGestureReanimatedScroll({ isDarkMode }: StepProps) {
  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.reanimatedScroll}
        contentContainerStyle={styles.reanimatedScrollContent}
        testID="gesture-reanimated-scroll"
      >
        {Array.from({ length: 30 }, (_, i) => i + 1).map((i) => (
          <View key={i} style={styles.reanimatedScrollItem}>
            <Text style={[styles.reanimatedScrollText, isDarkMode && styles.textDark]}>
              Reanimated 목록 아이템 {i}
            </Text>
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  reanimatedScroll: { flex: 1, minHeight: 0, maxHeight: 200 },
  reanimatedScrollContent: { paddingVertical: 8, paddingBottom: 24 },
  reanimatedScrollItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e8f4fc',
    borderRadius: 8,
    marginBottom: 8,
  },
  reanimatedScrollText: { fontSize: 14, color: '#333' },
  textDark: { color: '#fff' },
});
