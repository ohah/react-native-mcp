import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

export type StepProps = { isDarkMode: boolean };

export function StepGestureDrag({ _isDarkMode: isDarkMode }: StepProps) {
  const [dragCount, setDragCount] = React.useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const incrementDrag = useCallback(() => setDragCount((c) => c + 1), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startX.value = translateX.value;
          startY.value = translateY.value;
        })
        .onUpdate((e) => {
          translateX.value = startX.value + e.translationX;
          translateY.value = startY.value + e.translationY;
        })
        .onEnd(() => {
          runOnJS(incrementDrag)();
        }),
    [incrementDrag]
  );

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.hint, isDarkMode && styles.textDark]}>
        아래 박스를 드래그(swipe)하면 카운트가 올라갑니다. MCP: query_selector → measure → swipe.
      </Text>
      <Text style={[styles.countLabel, isDarkMode && styles.textDark]} testID="gesture-drag-count">
        드래그 완료: {dragCount}
      </Text>
      <View style={styles.area} testID="gesture-drag-area" collapsable={false}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.dragBox, isDarkMode && styles.dragBoxDark, boxStyle]}>
            <Text style={[styles.dragBoxText, isDarkMode && styles.textDark]}>드래그</Text>
          </Animated.View>
        </GestureDetector>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  hint: { fontSize: 12, marginBottom: 8, color: '#666' },
  textDark: { color: '#fff' },
  countLabel: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  area: { height: 160, justifyContent: 'center', alignItems: 'center' },
  dragBox: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#6b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragBoxDark: { backgroundColor: '#2d5a4a' },
  dragBoxText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
