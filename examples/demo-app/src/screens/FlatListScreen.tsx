/**
 * FlatList 탭 — testID 있음/없음 케이스, 스크롤 안 버튼 클릭 시 텍스트 변경 예제
 */

import React from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';

const LIST_DATA = Array.from({ length: 12 }, (_, i) => ({
  id: `item-${i}`,
  title: `Item ${i + 1}`,
}));

export type FlatListScreenProps = {
  isDarkMode: boolean;
};

/** testID 있음: 스크롤 후 click(uid) 또는 click_by_label로 버튼 클릭, "탭: N" 증가 */
function ListItemWithButton({
  item,
  isDarkMode,
  tapCount,
  onPress,
}: {
  item: { id: string; title: string };
  isDarkMode: boolean;
  tapCount: number;
  onPress: () => void;
}) {
  return (
    <View style={styles.listItem}>
      <Text style={[styles.listItemText, isDarkMode && styles.textDark]}>{item.title}</Text>
      <Pressable
        style={({ pressed }) => [styles.inListButton, pressed && styles.inListButtonPressed]}
        onPress={onPress}
        testID={`demo-app-flat-list-btn-${item.id}`}
      >
        <Text style={styles.inListButtonText}>탭: {tapCount}</Text>
      </Pressable>
    </View>
  );
}

/** testID 없음: 스냅샷에서는 uid가 경로, 클릭 시 "클릭: N" 텍스트 증가 */
function ListItemWithButtonNoTestId({
  item,
  isDarkMode,
  tapCount,
  onPress,
}: {
  item: { id: string; title: string };
  isDarkMode: boolean;
  tapCount: number;
  onPress: () => void;
}) {
  return (
    <View style={styles.listItem}>
      <Text style={[styles.listItemText, isDarkMode && styles.textDark]}>{item.title}</Text>
      <Pressable
        style={({ pressed }) => [styles.inListButton, pressed && styles.inListButtonPressed]}
        onPress={onPress}
      >
        <Text style={styles.inListButtonText}>클릭: {tapCount}</Text>
      </Pressable>
    </View>
  );
}

export function FlatListScreen({ isDarkMode }: FlatListScreenProps) {
  const [tapsWithId, setTapsWithId] = React.useState<Record<string, number>>({});
  const [tapsNoId, setTapsNoId] = React.useState<Record<string, number>>({});

  const renderItemWithTestId = ({ item }: { item: { id: string; title: string } }) => (
    <ListItemWithButton
      item={item}
      isDarkMode={isDarkMode}
      tapCount={tapsWithId[item.id] ?? 0}
      onPress={() => setTapsWithId((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))}
    />
  );
  const renderItemNoTestId = ({ item }: { item: { id: string; title: string } }) => (
    <ListItemWithButtonNoTestId
      item={item}
      isDarkMode={isDarkMode}
      tapCount={tapsNoId[item.id] ?? 0}
      onPress={() => setTapsNoId((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          FlatList (testID 있음) — 스크롤 후 click(uid)로 버튼 클릭, "탭: N" 증가
        </Text>
        <FlatList
          style={styles.flatList}
          data={LIST_DATA}
          keyExtractor={(item) => item.id}
          renderItem={renderItemWithTestId}
          testID="demo-app-flat-list"
        />
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          FlatList (testID 없음) — click_by_label로 버튼 클릭, "클릭: N" 증가
        </Text>
        <FlatList
          style={styles.flatList}
          data={LIST_DATA}
          keyExtractor={(item) => `no-id-${item.id}`}
          renderItem={renderItemNoTestId}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { flex: 1, minHeight: 200 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 24,
    paddingVertical: 8,
    color: '#333',
  },
  flatList: { flex: 1 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  listItemText: { fontSize: 16, color: '#333', flex: 1 },
  inListButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  inListButtonPressed: { opacity: 0.8 },
  inListButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  textDark: { color: '#fff' },
});
