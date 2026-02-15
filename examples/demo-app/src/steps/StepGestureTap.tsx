import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export type StepProps = { isDarkMode: boolean };

export function StepGestureTap({ isDarkMode }: StepProps) {
  const [tapGestureCount, setTapGestureCount] = React.useState(0);
  const increment = useCallback(() => setTapGestureCount((c) => c + 1), []);
  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(increment)();
      }),
    [increment]
  );
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View
          style={[styles.tapBox, isDarkMode && styles.tapBoxDark]}
          testID="gesture-tap-detector-wrapper"
          collapsable={false}
        >
          <GestureDetector gesture={tapGesture}>
            <View style={[styles.tapInner, isDarkMode && styles.tapBoxDark]}>
              <Text style={[styles.tapLabel, isDarkMode && styles.textDark]}>Tap 제스처 영역</Text>
              <Text style={[styles.tapCount, isDarkMode && styles.textDark]}>
                {tapGestureCount}
              </Text>
            </View>
          </GestureDetector>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  container: { justifyContent: 'center', alignItems: 'center' },
  tapBox: { paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#6b8', borderRadius: 12 },
  tapBoxDark: { backgroundColor: '#2d5a4a' },
  tapInner: { paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  tapLabel: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 4 },
  tapCount: { fontSize: 20, fontWeight: '700', color: '#000' },
  textDark: { color: '#fff' },
});
