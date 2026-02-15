import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import {
  TouchableOpacity as GHTouchableOpacity,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const DRAWER_WIDTH = 220;

export type StepProps = { isDarkMode: boolean };

export function StepGestureDrawer({ isDarkMode }: StepProps) {
  const [drawerIsOpen, setDrawerIsOpen] = React.useState(false);
  const drawerOffset = useSharedValue(-DRAWER_WIDTH);
  const openDrawer = useCallback(() => {
    drawerOffset.value = withSpring(0, { damping: 20, stiffness: 150 });
    setDrawerIsOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    drawerOffset.value = withSpring(-DRAWER_WIDTH, { damping: 20, stiffness: 150 });
    setDrawerIsOpen(false);
  }, []);
  const drawerOpenPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(15)
        .failOffsetY([-15, 15])
        .onUpdate((e) => {
          drawerOffset.value = Math.max(-DRAWER_WIDTH, Math.min(0, -DRAWER_WIDTH + e.translationX));
        })
        .onEnd((e) => {
          if (e.velocityX > 100 || drawerOffset.value > -DRAWER_WIDTH / 2) {
            drawerOffset.value = withSpring(0, { damping: 20, stiffness: 150 });
            runOnJS(setDrawerIsOpen)(true);
          } else {
            drawerOffset.value = withSpring(-DRAWER_WIDTH, { damping: 20, stiffness: 150 });
            runOnJS(setDrawerIsOpen)(false);
          }
        }),
    []
  );
  const drawerClosePan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(-15)
        .failOffsetY([-15, 15])
        .onUpdate((e) => {
          drawerOffset.value = Math.max(-DRAWER_WIDTH, Math.min(0, e.translationX));
        })
        .onEnd((e) => {
          if (e.velocityX < -100 || drawerOffset.value < -DRAWER_WIDTH / 2) {
            drawerOffset.value = withSpring(-DRAWER_WIDTH, { damping: 20, stiffness: 150 });
            runOnJS(setDrawerIsOpen)(false);
          } else {
            drawerOffset.value = withSpring(0, { damping: 20, stiffness: 150 });
            runOnJS(setDrawerIsOpen)(true);
          }
        }),
    []
  );
  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerOffset.value }],
  }));
  const drawerOverlayStyle = useAnimatedStyle(() => ({
    opacity: ((drawerOffset.value + DRAWER_WIDTH) / DRAWER_WIDTH) * 0.5,
  }));
  return (
    <View style={styles.screen}>
      {!drawerIsOpen && (
        <GestureDetector gesture={drawerOpenPan}>
          <View style={styles.drawerLeftStrip} />
        </GestureDetector>
      )}
      <View style={styles.container}>
        <GHTouchableOpacity
          style={styles.drawerOpenBtn}
          onPress={openDrawer}
          testID="gesture-drawer-open"
        >
          <Text style={styles.drawerOpenBtnText}>Drawer 열기</Text>
        </GHTouchableOpacity>
      </View>
      {drawerIsOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 11 }]}
          onPress={closeDrawer}
          testID="drawer-overlay"
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.drawerOverlay, drawerOverlayStyle]}
          />
        </Pressable>
      )}
      <GestureDetector gesture={drawerClosePan}>
        <Animated.View style={[styles.drawer, drawerStyle]}>
          <View style={[styles.drawerContent, isDarkMode && styles.drawerContentDark]}>
            <Text style={[styles.drawerTitle, isDarkMode && styles.textDark]}>Drawer</Text>
            <Text
              testID="drawer-status"
              style={[styles.drawerStatusText, isDarkMode && styles.textDark]}
            >
              드로워: {drawerIsOpen ? '열림 ✅' : '닫힘'}
            </Text>
            <GHTouchableOpacity style={styles.drawerCloseBtn} onPress={closeDrawer}>
              <Text style={styles.drawerCloseText}>닫기</Text>
            </GHTouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  drawerOverlay: { backgroundColor: '#000' },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#e0e0e0',
    paddingTop: 48,
    paddingHorizontal: 16,
    zIndex: 12,
    elevation: 12,
  },
  drawerContent: {},
  drawerContentDark: { backgroundColor: '#2a2a2a' },
  drawerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#000' },
  drawerStatusText: { fontSize: 14, fontWeight: '600', marginBottom: 16, color: '#333' },
  textDark: { color: '#fff' },
  drawerCloseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#666',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  drawerCloseText: { color: '#fff', fontWeight: '600' },
  drawerLeftStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 13,
  },
  drawerOpenBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#c60',
    borderRadius: 8,
  },
  drawerOpenBtnText: { color: '#fff', fontWeight: '600' },
});
