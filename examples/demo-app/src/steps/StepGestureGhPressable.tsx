import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';

export type StepProps = { isDarkMode: boolean };

export function StepGestureGhPressable({ isDarkMode: _isDarkMode }: StepProps) {
  const [ghTaps, setGhTaps] = React.useState(0);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <GHTouchableOpacity
          style={styles.ghButton}
          onPress={() => setGhTaps((n) => n + 1)}
          testID="gesture-gh-pressable"
          activeOpacity={0.8}
        >
          <Text style={styles.ghButtonText}>RNGH TouchableOpacity: {ghTaps}</Text>
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
  ghButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
