/**
 * Gesture 탭 — react-native-gesture-handler + react-native-reanimated 예제
 * MCP: testID 있음 → click(uid), testID 없음 → click_by_label 로 각각 탭 가능
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export type GestureScreenProps = {
  isDarkMode: boolean;
};

export function GestureScreen({ isDarkMode }: GestureScreenProps) {
  const [ghTaps, setGhTaps] = React.useState(0);
  const [ghTapsNoId, setGhTapsNoId] = React.useState(0);
  const [reanimatedTaps, setReanimatedTaps] = React.useState(0);
  const [reanimatedTapsNoId, setReanimatedTapsNoId] = React.useState(0);
  const scale = useSharedValue(1);
  const scaleNoId = useSharedValue(1);

  const animatedBoxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const animatedBoxStyleNoId = useAnimatedStyle(() => ({
    transform: [{ scale: scaleNoId.value }],
  }));

  const onReanimatedPressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };
  const onReanimatedPressOut = () => {
    scale.value = withSpring(1);
  };
  const onReanimatedPressInNoId = () => {
    scaleNoId.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };
  const onReanimatedPressOutNoId = () => {
    scaleNoId.value = withSpring(1);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDarkMode && styles.textDark]}>Gesture</Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
        react-native-gesture-handler + react-native-reanimated
      </Text>

      {/* testID 있음 — MCP click(uid) */}
      <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
        GestureHandler TouchableOpacity (testID 있음)
      </Text>
      <GHTouchableOpacity
        style={styles.ghButton}
        onPress={() => setGhTaps((n) => n + 1)}
        testID="gesture-gh-pressable"
        activeOpacity={0.8}
      >
        <Text style={styles.ghButtonText}>RNGH TouchableOpacity: {ghTaps}</Text>
      </GHTouchableOpacity>

      {/* testID 없음 — MCP click_by_label */}
      <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
        GestureHandler TouchableOpacity (라벨만)
      </Text>
      <GHTouchableOpacity
        style={[styles.ghButton, styles.ghButtonSecondary]}
        onPress={() => setGhTapsNoId((n) => n + 1)}
        activeOpacity={0.8}
      >
        <Text style={styles.ghButtonTextSecondary}>RNGH 라벨만: {ghTapsNoId}</Text>
      </GHTouchableOpacity>

      {/* Reanimated: testID 있음 */}
      <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
        Reanimated 스케일 (testID 있음)
      </Text>
      <Animated.View style={[styles.animatedBox, animatedBoxStyle]} testID="gesture-reanimated-box">
        <GHTouchableOpacity
          style={styles.animatedBoxInner}
          onPressIn={onReanimatedPressIn}
          onPressOut={onReanimatedPressOut}
          onPress={() => setReanimatedTaps((n) => n + 1)}
          testID="gesture-reanimated-trigger"
          activeOpacity={1}
        >
          <Text style={styles.animatedBoxText}>눌러보세요</Text>
          <Text style={styles.animatedBoxText}>{reanimatedTaps}</Text>
        </GHTouchableOpacity>
      </Animated.View>

      {/* Reanimated: testID 없음 — click_by_label "눌러보세요 (라벨만)" */}
      <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
        Reanimated 스케일 (라벨만)
      </Text>
      <Animated.View style={[styles.animatedBox, animatedBoxStyleNoId]}>
        <GHTouchableOpacity
          style={[styles.animatedBoxInner, styles.animatedBoxInnerSecondary]}
          onPressIn={onReanimatedPressInNoId}
          onPressOut={onReanimatedPressOutNoId}
          onPress={() => setReanimatedTapsNoId((n) => n + 1)}
          activeOpacity={1}
        >
          <Text style={styles.animatedBoxText}>눌러보세요 (라벨만)</Text>
          <Text style={styles.animatedBoxText}>{reanimatedTapsNoId}</Text>
        </GHTouchableOpacity>
      </Animated.View>

      {/* Reanimated ScrollView */}
      <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
        Reanimated ScrollView
      </Text>
      <Animated.ScrollView
        style={styles.reanimatedScroll}
        contentContainerStyle={styles.reanimatedScrollContent}
        testID="gesture-reanimated-scroll"
      >
        {[1, 2, 3, 4, 5].map((i) => (
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
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: '#000' },
  textDark: { color: '#fff' },
  subtitle: { fontSize: 13, marginBottom: 12, color: '#333' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#333' },
  ghButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    marginBottom: 16,
  },
  ghButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  ghButtonSecondary: { backgroundColor: '#663399' },
  ghButtonTextSecondary: { color: '#fff', fontSize: 16, fontWeight: '600' },
  animatedBox: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  animatedBoxInner: {
    width: 120,
    height: 80,
    backgroundColor: '#0a6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedBoxText: { color: '#fff', fontWeight: '600' },
  animatedBoxInnerSecondary: { backgroundColor: '#c96' },
  reanimatedScroll: { flex: 1, minHeight: 0, maxHeight: 160 },
  reanimatedScrollContent: { paddingVertical: 8, paddingBottom: 24 },
  reanimatedScrollItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e8f4fc',
    borderRadius: 8,
    marginBottom: 8,
  },
  reanimatedScrollText: { fontSize: 14, color: '#333' },
});
