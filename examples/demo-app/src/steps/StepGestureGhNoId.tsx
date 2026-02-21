import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';

export type StepProps = { isDarkMode: boolean };

export function StepGestureGhNoId({ isDarkMode: _isDarkMode }: StepProps) {
  const [count, setCount] = React.useState(0);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <GHTouchableOpacity
          style={[styles.ghButton, styles.ghButtonSecondary]}
          onPress={() => setCount((n) => n + 1)}
          activeOpacity={0.8}
        >
          <Text style={styles.ghButtonText}>RNGH 라벨만: {count}</Text>
        </GHTouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  container: { justifyContent: 'center', alignItems: 'center' },
  ghButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
  },
  ghButtonSecondary: { backgroundColor: '#663399' },
  ghButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
