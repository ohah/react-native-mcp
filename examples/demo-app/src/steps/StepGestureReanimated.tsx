import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export type StepProps = { isDarkMode: boolean };

export function StepGestureReanimated({ isDarkMode: _isDarkMode }: StepProps) {
  const [taps, setTaps] = React.useState(0);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Animated.View style={[styles.animatedBox, animatedStyle]} testID="gesture-reanimated-box">
          <GHTouchableOpacity
            style={styles.animatedBoxInner}
            onPressIn={() => {
              scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
            }}
            onPressOut={() => {
              scale.value = withSpring(1);
            }}
            onPress={() => setTaps((n) => n + 1)}
            testID="gesture-reanimated-trigger"
            activeOpacity={1}
          >
            <Text style={styles.animatedBoxText}>눌러보세요</Text>
            <Text style={styles.animatedBoxText}>{taps}</Text>
          </GHTouchableOpacity>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  container: { justifyContent: 'center', alignItems: 'center' },
  animatedBox: { alignSelf: 'center' },
  animatedBoxInner: {
    width: 120,
    height: 80,
    backgroundColor: '#0a6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedBoxText: { color: '#fff', fontWeight: '600' },
});
