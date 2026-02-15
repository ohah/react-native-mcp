import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const BOTTOM_SHEET_HEIGHT = 180;

export type StepProps = { isDarkMode: boolean };

export function StepGestureBottomSheet({ isDarkMode }: StepProps) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const sheetOffset = useSharedValue(BOTTOM_SHEET_HEIGHT);
  const startOffset = useSharedValue(BOTTOM_SHEET_HEIGHT);
  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startOffset.value = sheetOffset.value;
        })
        .onUpdate((e) => {
          const next = startOffset.value + e.translationY;
          if (next >= 0 && next <= BOTTOM_SHEET_HEIGHT) sheetOffset.value = next;
        })
        .onEnd((e) => {
          const wantOpen = e.velocityY < -100 || sheetOffset.value < BOTTOM_SHEET_HEIGHT / 2;
          const wantClose = e.velocityY > 100 || sheetOffset.value >= BOTTOM_SHEET_HEIGHT / 2;
          if (wantClose && !wantOpen) {
            sheetOffset.value = withSpring(BOTTOM_SHEET_HEIGHT, { damping: 20, stiffness: 150 });
            runOnJS(setSheetOpen)(false);
          } else {
            sheetOffset.value = withSpring(0, { damping: 20, stiffness: 150 });
            runOnJS(setSheetOpen)(true);
          }
        }),
    []
  );
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetOffset.value }],
  }));
  return (
    <View style={styles.screen}>
      <View style={styles.container}>
        <Text style={[styles.hint, isDarkMode && styles.textDark]}>
          아래 시트를 위로 드래그해서 열기
        </Text>
      </View>
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <GestureDetector gesture={sheetPan}>
          <Animated.View
            style={[styles.bottomSheet, sheetStyle, isDarkMode && styles.bottomSheetDark]}
          >
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, isDarkMode && styles.textDark]}>Bottom sheet</Text>
            <Text testID="sheet-status" style={[styles.sheetHint, isDarkMode && styles.textDark]}>
              상태: {sheetOpen ? '열림 ✅' : '닫힘'}
            </Text>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: 24 },
  hint: { fontSize: 12, color: '#666' },
  textDark: { color: '#fff' },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_SHEET_HEIGHT + 40,
    zIndex: 5,
    pointerEvents: 'box-none',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_SHEET_HEIGHT + 24,
    backgroundColor: '#eee',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  bottomSheetDark: { backgroundColor: '#2a2a2a' },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#999',
    borderRadius: 2,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  sheetHint: { fontSize: 12, color: '#666', marginTop: 4 },
});
