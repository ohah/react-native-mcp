/**
 * Gesture 탭 — react-native-gesture-handler + react-native-reanimated 예제
 *
 * - MCP 호환성 비교: RN TouchableOpacity / RN Pressable / RNGH TouchableOpacity 각각 testID + 카운터.
 *   MCP click(uid) 또는 수동 탭 시 어떤 컴포넌트가 감지하는지 비교 가능 (플랫폼·아키텍처별 차이 있을 수 있음).
 * - Gesture.Tap() 감지 테스트: RNGH Gesture.Tap() + runOnJS 카운터. 네이티브 제스처 인식기 기반이라
 *   MCP/자동화 터치로는 카운터가 증가하지 않을 수 있음.
 * - MCP: testID 있음 → click(uid), testID 없음 → click_by_label. 하단: swipe to delete, pull to refresh 등.
 */

import React, { useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import {
  TouchableOpacity as GHTouchableOpacity,
  GestureDetector,
  Gesture,
  Swipeable,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const DRAWER_WIDTH = 220;
const BOTTOM_SHEET_HEIGHT = 180;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // MCP/자동화 호환성 비교: Touchable vs Pressable vs GestureHandler
  const [compareTouchableTaps, setCompareTouchableTaps] = React.useState(0);
  const [comparePressableTaps, setComparePressableTaps] = React.useState(0);
  const [compareGhTaps, setCompareGhTaps] = React.useState(0);
  // Gesture.Tap() 감지 테스트 (제스처 API는 네이티브 레벨이라 MCP 트리거 시 미동작 가능)
  const [tapGestureCount, setTapGestureCount] = React.useState(0);
  const incrementTapGestureCount = useCallback(() => {
    setTapGestureCount((c) => c + 1);
  }, []);

  // Bottom sheet 상태 (드래그 검증용)
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Tab swipe (페이저) 현재 페이지 인디케이터
  const [currentPage, setCurrentPage] = React.useState(1);

  // Pull to refresh (DESIGN.md: onRefresh 호출 가능성)
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshCount, setRefreshCount] = React.useState(0);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setRefreshCount((n) => n + 1);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Drag & drop (PanResponder — 시뮬레이션 복잡)
  const dragPos = useRef({ x: 0, y: 0 });
  const [dragXY, setDragXY] = React.useState({ x: 0, y: 0 });
  const dragXYRef = useRef(dragXY);
  dragXYRef.current = dragXY;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragPos.current = { x: dragXYRef.current.x, y: dragXYRef.current.y };
        },
        onPanResponderMove: (_, g) => {
          setDragXY({
            x: dragPos.current.x + g.dx,
            y: dragPos.current.y + g.dy,
          });
        },
      }),
    []
  );

  // Drawer (스와이프로 열기·닫기 / openDrawer 가능성)
  const drawerOffset = useSharedValue(-DRAWER_WIDTH);
  const [drawerIsOpen, setDrawerIsOpen] = React.useState(false);
  const openDrawer = useCallback(() => {
    drawerOffset.value = withSpring(0, { damping: 20, stiffness: 150 });
    setDrawerIsOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    drawerOffset.value = withSpring(-DRAWER_WIDTH, { damping: 20, stiffness: 150 });
    setDrawerIsOpen(false);
  }, []);
  // 열기 제스처: 왼쪽 스트립에서 오른쪽으로 스와이프
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
  // 닫기 제스처: 드로워 패널에서 왼쪽으로 스와이프
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

  // Bottom sheet (드래그로 시트 이동 / ref.snapToIndex 가능성)
  const sheetOffset = useSharedValue(BOTTOM_SHEET_HEIGHT);
  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          const next = BOTTOM_SHEET_HEIGHT + e.translationY;
          if (next >= 0 && next <= BOTTOM_SHEET_HEIGHT) sheetOffset.value = next;
        })
        .onEnd((e) => {
          if (e.velocityY < -100 || sheetOffset.value < BOTTOM_SHEET_HEIGHT / 2) {
            sheetOffset.value = withSpring(0, { damping: 20, stiffness: 150 });
            runOnJS(setSheetOpen)(true);
          } else {
            sheetOffset.value = withSpring(BOTTOM_SHEET_HEIGHT, { damping: 20, stiffness: 150 });
            runOnJS(setSheetOpen)(false);
          }
        }),
    []
  );
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetOffset.value }],
  }));

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

  // ─── Reanimated worklet 제스처 (MCP 제어 불가 테스트): 드래그만 worklet에서 처리
  const [workletDragCount, setWorkletDragCount] = React.useState(0);
  const incrementWorkletDrag = useCallback(() => setWorkletDragCount((c) => c + 1), []);
  const workletTranslateX = useSharedValue(0);
  const workletTranslateY = useSharedValue(0);
  const workletSavedX = useSharedValue(0);
  const workletSavedY = useSharedValue(0);
  const workletPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          workletTranslateX.value = workletSavedX.value + e.translationX;
          workletTranslateY.value = workletSavedY.value + e.translationY;
        })
        .onEnd(() => {
          workletSavedX.value = workletTranslateX.value;
          workletSavedY.value = workletTranslateY.value;
          runOnJS(incrementWorkletDrag)();
        }),
    [incrementWorkletDrag]
  );
  const workletBoxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: workletTranslateX.value }, { translateY: workletTranslateY.value }],
  }));

  // ─── RNGH Gesture.Pan / Pinch / Rotation (MCP 제어 불가 테스트)
  const rnghTranslateX = useSharedValue(0);
  const rnghTranslateY = useSharedValue(0);
  const rnghSavedX = useSharedValue(0);
  const rnghSavedY = useSharedValue(0);
  const rnghScale = useSharedValue(1);
  const rnghSavedScale = useSharedValue(1);
  const rnghRotation = useSharedValue(0);
  const rnghSavedRotation = useSharedValue(0);
  const rnghComposed = useMemo(() => {
    const pan = Gesture.Pan()
      .onUpdate((e) => {
        rnghTranslateX.value = rnghSavedX.value + e.translationX;
        rnghTranslateY.value = rnghSavedY.value + e.translationY;
      })
      .onEnd(() => {
        rnghSavedX.value = rnghTranslateX.value;
        rnghSavedY.value = rnghTranslateY.value;
      });
    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        rnghScale.value = rnghSavedScale.value * e.scale;
      })
      .onEnd(() => {
        rnghSavedScale.value = rnghScale.value;
      });
    const rotation = Gesture.Rotation()
      .onUpdate((e) => {
        rnghRotation.value = rnghSavedRotation.value + e.rotation;
      })
      .onEnd(() => {
        rnghSavedRotation.value = rnghRotation.value;
      });
    return Gesture.Simultaneous(pan, pinch, rotation);
  }, []);
  const rnghBoxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rnghTranslateX.value },
      { translateY: rnghTranslateY.value },
      { scale: rnghScale.value },
      { rotate: `${rnghRotation.value}rad` },
    ],
  }));

  // Gesture.Tap() — 네이티브 제스처 인식. MCP/자동화 터치 시 onEnd 호출 여부 확인용.
  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(incrementTapGestureCount)();
      }),
    [incrementTapGestureCount]
  );

  return (
    <View style={styles.screen}>
      {/* Drawer edge: 왼쪽 가장자리 스와이프로 열기 (ScrollView 아래에 렌더) */}
      {!drawerIsOpen && (
        <GestureDetector gesture={drawerOpenPan}>
          <View style={styles.drawerLeftStrip} />
        </GestureDetector>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <Text style={[styles.title, isDarkMode && styles.textDark]}>Gesture</Text>
          <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
            react-native-gesture-handler + react-native-reanimated
          </Text>

          {/* ─── MCP/자동화 호환성 비교: Touchable vs Pressable vs RNGH TouchableOpacity ─── */}
          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            MCP 호환성 비교 (Touchable / Pressable / GestureHandler)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            MCP click(uid) 또는 수동 탭 시 카운터 증가 여부로 감지 가능 여부 확인. 플랫폼·아키텍처별
            차이 있을 수 있음.
          </Text>
          <View style={styles.compareCol}>
            <TouchableOpacity
              style={[styles.compareBtn, styles.compareBtnTouchable]}
              onPress={() => setCompareTouchableTaps((n) => n + 1)}
              testID="gesture-compare-touchable"
              activeOpacity={0.8}
            >
              <Text style={styles.compareBtnLabel}>RN TouchableOpacity</Text>
              <Text style={styles.compareBtnCount}>{compareTouchableTaps}</Text>
            </TouchableOpacity>
            <Pressable
              style={({ pressed }) => [
                styles.compareBtn,
                styles.compareBtnPressable,
                pressed && styles.compareBtnPressed,
              ]}
              onPress={() => setComparePressableTaps((n) => n + 1)}
              testID="gesture-compare-pressable"
            >
              <Text style={styles.compareBtnLabel}>RN Pressable</Text>
              <Text style={styles.compareBtnCount}>{comparePressableTaps}</Text>
            </Pressable>
            <GHTouchableOpacity
              style={[styles.compareBtn, styles.compareBtnGh]}
              onPress={() => setCompareGhTaps((n) => n + 1)}
              testID="gesture-compare-gh-touchable"
              activeOpacity={0.8}
            >
              <Text style={styles.compareBtnLabel}>RNGH TouchableOpacity</Text>
              <Text style={styles.compareBtnCount}>{compareGhTaps}</Text>
            </GHTouchableOpacity>
          </View>

          {/* Gesture.Tap() 감지 테스트 — 제스처 API는 네이티브 레벨이라 MCP 터치 시 미동작 가능 */}
          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Gesture.Tap() 감지 테스트
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            RNGH Gesture.Tap() 사용. 네이티브 제스처 인식기 기반이라 MCP/자동화 터치로는 카운터가
            증가하지 않을 수 있음.
          </Text>
          <View
            style={styles.tapGestureWrap}
            testID="gesture-tap-detector-wrapper"
            collapsable={false}
          >
            <GestureDetector gesture={tapGesture}>
              <View style={[styles.tapGestureBox, isDarkMode && styles.tapGestureBoxDark]}>
                <Text style={[styles.tapGestureLabel, isDarkMode && styles.textDark]}>
                  Tap 제스처 영역 (testID: gesture-tap-detector-wrapper)
                </Text>
                <Text style={[styles.tapGestureCount, isDarkMode && styles.textDark]}>
                  {tapGestureCount}
                </Text>
              </View>
            </GestureDetector>
          </View>

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
          <Animated.View
            style={[styles.animatedBox, animatedBoxStyle]}
            testID="gesture-reanimated-box"
          >
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

          {/* Reanimated worklet 제스처 — JS 콜백 없음, MCP 제어 불가 테스트 */}
          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Reanimated worklet 제스처 (MCP 제어 불가)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            드래그만 워클릿에서 처리. JS 스레드 콜백 없음.
          </Text>
          <View style={styles.workletArea}>
            <GestureDetector gesture={workletPanGesture}>
              <Animated.View style={[styles.workletBox, workletBoxStyle]}>
                <Text style={styles.workletBoxText}>드래그</Text>
                <Text testID="worklet-drag-count" style={styles.workletBoxText}>
                  횟수: {workletDragCount}
                </Text>
              </Animated.View>
            </GestureDetector>
          </View>

          {/* RNGH Gesture.Pan / Pinch / Rotation — 네이티브 스레드, MCP 제어 불가 테스트 */}
          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            RNGH Gesture.Pan / Pinch / Rotation (MCP 제어 불가)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            Pan·핀치·회전 모두 네이티브 스레드 실행, JS 콜백 없음.
          </Text>
          <View style={styles.rnghArea}>
            <GestureDetector gesture={rnghComposed}>
              <Animated.View style={[styles.rnghBox, rnghBoxStyle]}>
                <Text style={styles.rnghBoxText}>Pan / Pinch / Rotate</Text>
              </Animated.View>
            </GestureDetector>
          </View>

          {/* DESIGN.md 749–756: swipe to delete / pull to refresh / drag&drop / drawer / tab swipe / bottom sheet */}

          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Swipe to delete (MCP 제어 ❓)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            RNGH Swipeable. 스와이프 시 삭제 영역 노출. 라이브러리 의존.
          </Text>
          <View style={styles.swipeableList}>
            {[1, 2].map((i) => (
              <Swipeable
                key={i}
                renderRightActions={(_, __, _swipeable) => (
                  <View style={styles.swipeableAction}>
                    <Text style={styles.swipeableActionText}>삭제</Text>
                  </View>
                )}
              >
                <View style={[styles.swipeableRow, isDarkMode && styles.swipeableRowDark]}>
                  <Text style={[styles.swipeableRowText, isDarkMode && styles.textDark]}>
                    스와이프 to delete 행 {i}
                  </Text>
                </View>
              </Swipeable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Pull to refresh (onRefresh 호출 가능성 ✅)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            위에서 당겨 새로고침. RefreshControl onRefresh → MCP로 호출 가능할 수 있음.
          </Text>
          <View style={styles.refreshRow}>
            <Text style={[styles.refreshCount, isDarkMode && styles.textDark]}>
              새로고침 횟수: {refreshCount}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Drag & drop (MCP 제어 ❓)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            PanResponder 드래그. 콜백 시뮬레이션 복잡.
          </Text>
          <View style={styles.dragArea}>
            <View
              style={[
                styles.dragBox,
                { transform: [{ translateX: dragXY.x }, { translateY: dragXY.y }] },
              ]}
              {...panResponder.panHandlers}
            >
              <Text style={styles.dragBoxText}>드래그</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Drawer swipe / openDrawer 가능성 ✅
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            왼쪽 가장자리 스와이프 또는 아래 버튼으로 열기. react-navigation이면 openDrawer()로 제어
            가능.
          </Text>
          <GHTouchableOpacity
            style={styles.drawerOpenBtn}
            onPress={openDrawer}
            testID="gesture-drawer-open"
          >
            <Text style={styles.drawerOpenBtnText}>Drawer 열기</Text>
          </GHTouchableOpacity>

          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Tab swipe / ViewPager (scrollTo 제어 가능성 ✅)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            가로 스와이프로 페이지 전환. setPage(index) 또는 scrollTo로 제어 가능할 수 있음.
          </Text>
          <ScrollView
            horizontal
            pagingEnabled
            style={styles.pager}
            contentContainerStyle={styles.pagerContent}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH) + 1;
              setCurrentPage(page);
            }}
          >
            <View style={[styles.pagerPage, isDarkMode && styles.pagerPageDark]}>
              <Text style={[styles.pagerText, isDarkMode && styles.textDark]}>페이지 1</Text>
            </View>
            <View style={[styles.pagerPage, isDarkMode && styles.pagerPageDark]}>
              <Text style={[styles.pagerText, isDarkMode && styles.textDark]}>페이지 2</Text>
            </View>
            <View style={[styles.pagerPage, isDarkMode && styles.pagerPageDark]}>
              <Text style={[styles.pagerText, isDarkMode && styles.textDark]}>페이지 3</Text>
            </View>
          </ScrollView>
          <Text testID="pager-status" style={[styles.pagerStatus, isDarkMode && styles.textDark]}>
            현재 페이지: {currentPage} / 3
          </Text>

          <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
            Bottom sheet drag (ref.snapToIndex 가능성 ❓)
          </Text>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            아래에서 위로 드래그. @gorhom/bottom-sheet 등은 ref.snapToIndex(i)로 제어 가능.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom sheet: 고정 위치에서 드래그 */}
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <GestureDetector gesture={sheetPan}>
          <Animated.View
            style={[styles.bottomSheet, sheetStyle, isDarkMode && styles.bottomSheetDark]}
          >
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, isDarkMode && styles.textDark]}>Bottom sheet</Text>
            <Text style={[styles.sheetHint, isDarkMode && styles.textDark]}>
              위로 드래그해서 열기
            </Text>
            <Text
              testID="sheet-status"
              style={[
                styles.sheetHint,
                { fontWeight: '700', marginTop: 8 },
                isDarkMode && styles.textDark,
              ]}
            >
              상태: {sheetOpen ? '열림 ✅' : '닫힘'}
            </Text>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Drawer overlay: 열려있을 때 탭하면 닫기 (최상위 레이어) */}
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

      {/* Drawer: 왼쪽 패널. 스와이프로 닫기 (최상위 레이어) */}
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  container: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: '#000' },
  textDark: { color: '#fff' },
  subtitle: { fontSize: 13, marginBottom: 12, color: '#333' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#333' },
  hint: { fontSize: 12, marginBottom: 8, color: '#666' },
  compareCol: { gap: 12, marginBottom: 20 },
  compareBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  compareBtnTouchable: { backgroundColor: '#268' },
  compareBtnPressable: { backgroundColor: '#682' },
  compareBtnGh: { backgroundColor: '#826' },
  compareBtnPressed: { opacity: 0.85 },
  compareBtnLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  compareBtnCount: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  tapGestureWrap: { marginBottom: 20 },
  tapGestureBox: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#6b8',
    borderRadius: 12,
    alignItems: 'center',
  },
  tapGestureBoxDark: { backgroundColor: '#2d5a4a' },
  tapGestureLabel: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 4 },
  tapGestureCount: { fontSize: 20, fontWeight: '700', color: '#000' },
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
  workletArea: { height: 120, marginBottom: 24, justifyContent: 'center', alignItems: 'center' },
  workletBox: {
    width: 100,
    height: 64,
    backgroundColor: '#b85',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workletBoxText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  rnghArea: { height: 160, marginBottom: 24, justifyContent: 'center', alignItems: 'center' },
  rnghBox: {
    width: 100,
    height: 80,
    backgroundColor: '#48a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rnghBoxText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  screen: { flex: 1 },
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
  drawerContentDark: { backgroundColor: '#2a2a2a' },
  drawerContent: {},
  drawerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#000' },
  drawerCloseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#666',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  drawerCloseText: { color: '#fff', fontWeight: '600' },
  drawerStatusText: { fontSize: 14, fontWeight: '600', marginBottom: 16, color: '#333' },
  drawerLeftStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 30, zIndex: 13 },
  drawerOpenBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#c60',
    borderRadius: 8,
    marginBottom: 24,
  },
  drawerOpenBtnText: { color: '#fff', fontWeight: '600' },
  swipeableList: { marginBottom: 24 },
  swipeableRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  swipeableRowDark: { backgroundColor: '#333' },
  swipeableRowText: { fontSize: 15, color: '#000' },
  swipeableAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    backgroundColor: '#c44',
    borderRadius: 8,
    marginBottom: 8,
  },
  swipeableActionText: { color: '#fff', fontWeight: '600' },
  refreshRow: { paddingVertical: 8, marginBottom: 24 },
  refreshCount: { fontSize: 14, color: '#333' },
  dragArea: { height: 100, marginBottom: 24, justifyContent: 'center', alignItems: 'center' },
  dragBox: {
    width: 80,
    height: 56,
    backgroundColor: '#6a6',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragBoxText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pager: { marginHorizontal: -24, marginBottom: 24 },
  pagerContent: {},
  pagerPage: {
    width: SCREEN_WIDTH,
    height: 80,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagerPageDark: { backgroundColor: '#333' },
  pagerText: { fontSize: 16, color: '#000' },
  pagerStatus: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 24 },
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
  sheetHandle: { width: 40, height: 4, backgroundColor: '#999', borderRadius: 2, marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  sheetHint: { fontSize: 12, color: '#666', marginTop: 4 },
});
