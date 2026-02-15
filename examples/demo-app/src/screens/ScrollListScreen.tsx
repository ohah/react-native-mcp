/**
 * Scroll 탭 — ScrollView + FlatList 통합 (세그먼트로 전환)
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { ScrollViewScreen } from './ScrollViewScreen';
import { FlatListScreen } from './FlatListScreen';

export type ScrollListScreenProps = {
  isDarkMode: boolean;
};

type Segment = 'scroll' | 'list';

export function ScrollListScreen({ isDarkMode }: ScrollListScreenProps) {
  const [segment, setSegment] = React.useState<Segment>('scroll');

  return (
    <View style={styles.container}>
      <View style={[styles.segmentRow, isDarkMode && styles.segmentRowDark]}>
        <Pressable
          style={[styles.segmentBtn, segment === 'scroll' && styles.segmentBtnActive]}
          onPress={() => setSegment('scroll')}
          testID="scroll-list-segment-scroll"
        >
          <Text
            style={[
              styles.segmentText,
              segment === 'scroll' && styles.segmentTextActive,
              isDarkMode && styles.textDark,
            ]}
          >
            ScrollView
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, segment === 'list' && styles.segmentBtnActive]}
          onPress={() => setSegment('list')}
          testID="scroll-list-segment-list"
        >
          <Text
            style={[
              styles.segmentText,
              segment === 'list' && styles.segmentTextActive,
              isDarkMode && styles.textDark,
            ]}
          >
            FlatList
          </Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {segment === 'scroll' && <ScrollViewScreen isDarkMode={isDarkMode} />}
        {segment === 'list' && <FlatListScreen isDarkMode={isDarkMode} />}
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
