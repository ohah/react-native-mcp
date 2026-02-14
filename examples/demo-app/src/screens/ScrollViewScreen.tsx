/**
 * ScrollView 탭 — 상단 50% testID 있음, 하단 50% testID 없음. 각 블록 안에 버튼 이벤트.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TouchableOpacity,
  TouchableHighlight,
  Button,
  Image,
  ScrollView,
} from 'react-native';

export type ScrollViewScreenProps = {
  isDarkMode: boolean;
  count: number;
  setCount: React.Dispatch<React.SetStateAction<number>>;
  noTestIdTaps: number;
  setNoTestIdTaps: React.Dispatch<React.SetStateAction<number>>;
  setDynamicLabelTaps: React.Dispatch<React.SetStateAction<number>>;
  dynamicButtonLabel: string;
  touchableOpacityTaps: number;
  setTouchableOpacityTaps: React.Dispatch<React.SetStateAction<number>>;
  touchableHighlightTaps: number;
  setTouchableHighlightTaps: React.Dispatch<React.SetStateAction<number>>;
  rnButtonTaps: number;
  setRnButtonTaps: React.Dispatch<React.SetStateAction<number>>;
  imageOnlyTaps: number;
  setImageOnlyTaps: React.Dispatch<React.SetStateAction<number>>;
  iconLabelTaps: number;
  setIconLabelTaps: React.Dispatch<React.SetStateAction<number>>;
  noTestIdScrollTaps1: number;
  setNoTestIdScrollTaps1: React.Dispatch<React.SetStateAction<number>>;
  noTestIdScrollTaps2: number;
  setNoTestIdScrollTaps2: React.Dispatch<React.SetStateAction<number>>;
};

export function ScrollViewScreen({
  isDarkMode,
  count,
  setCount,
  noTestIdTaps,
  setNoTestIdTaps,
  setDynamicLabelTaps,
  dynamicButtonLabel,
  touchableOpacityTaps,
  setTouchableOpacityTaps,
  touchableHighlightTaps,
  setTouchableHighlightTaps,
  rnButtonTaps,
  setRnButtonTaps,
  imageOnlyTaps,
  setImageOnlyTaps,
  iconLabelTaps,
  setIconLabelTaps,
  noTestIdScrollTaps1,
  setNoTestIdScrollTaps1,
  noTestIdScrollTaps2,
  setNoTestIdScrollTaps2,
}: ScrollViewScreenProps) {
  const [moreTaps, setMoreTaps] = React.useState<number[]>(() => Array(10).fill(0));
  const scrollRefWithRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDarkMode && styles.textDark]} testID="demo-app-title">
        React Native MCP Demo
      </Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]} testID="demo-app-subtitle">
        ScrollView — ref 없음 / ref 있음(합성) / testID 없음
      </Text>

      {/* 1/3: testID 있음, ref 없음 → Babel이 ref만 주입 */}
      <View style={styles.third}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          ScrollView (testID, ref 없음) — scroll 도구로 제어
        </Text>
        <ScrollView
          style={styles.scrollBlock}
          contentContainerStyle={styles.scrollBlockContent}
          testID="demo-app-scroll-view"
        >
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => setCount((c) => c + 1)}
            testID="demo-app-counter-button"
          >
            <Text style={styles.buttonText}>Count: {count}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonSecondary,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              console.log('[Demo] Console button pressed at', new Date().toISOString());
              console.warn('[Demo] Sample warning for MCP console monitoring');
            }}
            testID="demo-app-console-button"
          >
            <Text style={styles.buttonTextSecondary}>Console</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonSecondary,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              fetch('https://httpbin.org/get?demo=1')
                .then((res) => res.json())
                .then((data) => console.log('[Demo] Network response:', data))
                .catch((err) => console.warn('[Demo] Network error:', err));
            }}
            testID="demo-app-network-button"
          >
            <Text style={styles.buttonTextSecondary}>Network</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonNoTestId,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setNoTestIdTaps((n) => n + 1)}
          >
            <Text style={styles.buttonTextSecondary}>testID 없음 ({noTestIdTaps})</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonDynamicLabel,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setDynamicLabelTaps((n) => n + 1)}
          >
            <Text style={styles.buttonTextSecondary}>{dynamicButtonLabel}</Text>
          </Pressable>
          <TouchableOpacity
            style={[styles.button, styles.buttonTouchableOpacity]}
            onPress={() => setTouchableOpacityTaps((n) => n + 1)}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonTextSecondary}>
              TouchableOpacity ({touchableOpacityTaps})
            </Text>
          </TouchableOpacity>
          <TouchableHighlight
            style={[styles.button, styles.buttonTouchableHighlight]}
            onPress={() => setTouchableHighlightTaps((n) => n + 1)}
            underlayColor="#6a8"
          >
            <Text style={styles.buttonTextSecondary}>
              TouchableHighlight ({touchableHighlightTaps})
            </Text>
          </TouchableHighlight>
          <View style={styles.buttonWrapper}>
            <Button
              title={`RN Button (${rnButtonTaps})`}
              onPress={() => setRnButtonTaps((n) => n + 1)}
            />
          </View>
          <Pressable
            style={[styles.button, styles.buttonImageOnly]}
            onPress={() => setImageOnlyTaps((n) => n + 1)}
            accessibilityLabel={`Image only button (${imageOnlyTaps})`}
          >
            <Image
              source={{ uri: 'https://via.placeholder.com/24x24/648/fff?text=+' }}
              style={styles.iconImage}
              accessibilityLabel="Image only button"
            />
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonIconLabel]}
            onPress={() => setIconLabelTaps((n) => n + 1)}
          >
            <Image
              source={{ uri: 'https://via.placeholder.com/20x20/486/fff?text=+' }}
              style={styles.iconImageSmall}
            />
            <Text style={styles.buttonTextSecondary}>Icon + Label ({iconLabelTaps})</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 2/3: testID 있음, ref 있음 → Babel이 합성 (MCP scroll + scrollRefWithRef.current) */}
      <View style={styles.third}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          ScrollView (testID, ref 있음) — 합성, scroll(uid) 동일 동작
        </Text>
        <ScrollView
          ref={scrollRefWithRef}
          style={styles.scrollBlock}
          contentContainerStyle={styles.scrollBlockContent}
          testID="demo-app-scroll-view-with-ref"
        >
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            이 블록은 ref가 있어서 Babel이 합성. scroll 도구로 demo-app-scroll-view-with-ref 제어
            가능.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonNoTestIdBlock,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {}}
          >
            <Text style={styles.buttonTextSecondary}>합성 테스트 버튼</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 3/3: ScrollView (testID 없음) + 버튼들 */}
      <View style={styles.third}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          ScrollView (testID 없음) — click_by_label(라벨)
        </Text>
        <ScrollView style={styles.scrollBlock} contentContainerStyle={styles.scrollBlockContent}>
          <Text style={[styles.hint, isDarkMode && styles.textDark]}>
            이 블록 ScrollView에는 testID 없음. 버튼은 click_by_label로만 클릭 가능.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonNoTestIdBlock,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setNoTestIdScrollTaps1((n) => n + 1)}
          >
            <Text style={styles.buttonTextSecondary}>아래영역 버튼1 ({noTestIdScrollTaps1})</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonNoTestIdBlock,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setNoTestIdScrollTaps2((n) => n + 1)}
          >
            <Text style={styles.buttonTextSecondary}>아래영역 버튼2 ({noTestIdScrollTaps2})</Text>
          </Pressable>
          {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.button,
                styles.buttonNoTestIdBlock,
                pressed && styles.buttonPressed,
              ]}
              onPress={() =>
                setMoreTaps((prev) => {
                  const next = [...prev];
                  next[i - 3] += 1;
                  return next;
                })
              }
            >
              <Text style={styles.buttonTextSecondary}>
                아래영역 버튼{i} ({moreTaps[i - 3]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: '#000' },
  textDark: { color: '#fff' },
  subtitle: { fontSize: 13, marginBottom: 12, color: '#333' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#333' },
  half: { flex: 1, minHeight: 0 },
  third: { flex: 1, minHeight: 0 },
  scrollBlock: { flex: 1, minHeight: 0 },
  scrollBlockContent: { paddingVertical: 8, paddingBottom: 24, alignItems: 'center' },
  hint: { fontSize: 12, marginBottom: 12, color: '#666' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    marginTop: 12,
  },
  buttonSecondary: { backgroundColor: '#444' },
  buttonNoTestId: { backgroundColor: '#884' },
  buttonNoTestIdBlock: { backgroundColor: '#668' },
  buttonDynamicLabel: { backgroundColor: '#468' },
  buttonTouchableOpacity: { backgroundColor: '#648' },
  buttonTouchableHighlight: { backgroundColor: '#486' },
  buttonWrapper: { marginTop: 12 },
  buttonImageOnly: { backgroundColor: '#846', padding: 12 },
  buttonIconLabel: { backgroundColor: '#684', flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconImage: { width: 24, height: 24 },
  iconImageSmall: { width: 20, height: 20 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonTextSecondary: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
