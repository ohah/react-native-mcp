/**
 * Scroll 탭 — ScrollView 3종 스크롤 테스트
 * MCP: scroll 도구로 스크롤, query_selector로 버튼 찾아 measure 좌표 획득 → tap(idb/adb)로 클릭.
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type ScrollViewScreenProps = {
  isDarkMode: boolean;
};

export function ScrollViewScreen({ isDarkMode }: ScrollViewScreenProps) {
  const scrollRefWithRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [taps, setTaps] = React.useState<number[]>(() => Array(12).fill(0));

  const tap = (i: number) =>
    setTaps((prev) => {
      const next = [...prev];
      next[i] += 1;
      return next;
    });

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDarkMode && styles.textDark]}>Scroll</Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
        scroll 도구 — ref 없음 / ref 있음(합성) / testID 없음
      </Text>

      {/* 1/3: testID 있음, ref 없음 */}
      <View style={styles.third}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          ScrollView (testID, ref 없음)
        </Text>
        <ScrollView
          style={styles.scrollBlock}
          contentContainerStyle={styles.scrollBlockContent}
          testID="scroll-view-no-ref"
        >
          {[0, 1, 2, 3].map((i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => tap(i)}
              testID={`scroll-btn-${i}`}
            >
              <Text style={styles.buttonText}>
                버튼 {i} ({taps[i]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 2/3: testID 있음, ref 있음 → Babel 합성 */}
      <View style={styles.third}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          ScrollView (testID, ref 있음)
        </Text>
        <ScrollView
          ref={scrollRefWithRef}
          style={styles.scrollBlock}
          contentContainerStyle={styles.scrollBlockContent}
          testID="scroll-view-with-ref"
        >
          {[4, 5, 6, 7].map((i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => tap(i)}
              testID={`scroll-btn-${i}`}
            >
              <Text style={styles.buttonText}>
                버튼 {i} ({taps[i]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 3/3: testID 없음 */}
      <View style={styles.third}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          ScrollView (testID 없음)
        </Text>
        <ScrollView style={styles.scrollBlock} contentContainerStyle={styles.scrollBlockContent}>
          {[8, 9, 10, 11].map((i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.button,
                styles.buttonNoId,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => tap(i)}
            >
              <Text style={styles.buttonText}>
                버튼 {i} ({taps[i]})
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
  third: { flex: 1, minHeight: 0 },
  scrollBlock: { flex: 1, minHeight: 0 },
  scrollBlockContent: { paddingVertical: 8, paddingBottom: 24, alignItems: 'center' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    marginTop: 8,
  },
  buttonNoId: { backgroundColor: '#668' },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
