/**
 * Interact 탭 — Press + Input 통합 (세그먼트로 전환)
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { PressScreen } from './PressScreen';
import { InputScreen } from './InputScreen';

export type InteractScreenProps = {
  isDarkMode: boolean;
};

type Segment = 'press' | 'input';

export function InteractScreen({ isDarkMode }: InteractScreenProps) {
  const [segment, setSegment] = React.useState<Segment>('press');

  return (
    <View style={styles.container}>
      <View style={[styles.segmentRow, isDarkMode && styles.segmentRowDark]}>
        <Pressable
          style={[styles.segmentBtn, segment === 'press' && styles.segmentBtnActive]}
          onPress={() => setSegment('press')}
          testID="interact-segment-press"
        >
          <Text
            style={[
              styles.segmentText,
              segment === 'press' && styles.segmentTextActive,
              isDarkMode && styles.textDark,
            ]}
          >
            Press
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, segment === 'input' && styles.segmentBtnActive]}
          onPress={() => setSegment('input')}
          testID="interact-segment-input"
        >
          <Text
            style={[
              styles.segmentText,
              segment === 'input' && styles.segmentTextActive,
              isDarkMode && styles.textDark,
            ]}
          >
            Input
          </Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {segment === 'press' && <PressScreen isDarkMode={isDarkMode} />}
        {segment === 'input' && <InputScreen isDarkMode={isDarkMode} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
  segmentRowDark: { backgroundColor: '#2a2a2a', borderBottomColor: '#444' },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: { backgroundColor: '#0066cc' },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#333' },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  textDark: { color: '#fff' },
  content: { flex: 1 },
});
