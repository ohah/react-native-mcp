import React from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';

const LIST_SIZE = 30;
const LIST_DATA = Array.from({ length: LIST_SIZE }, (_, i) => ({
  id: `item-${i}`,
  title: `Item ${i + 1}`,
}));

export type StepProps = { isDarkMode: boolean };

export function StepFlatListWithId({ isDarkMode }: StepProps) {
  const [taps, setTaps] = React.useState<Record<string, number>>({});
  return (
    <View style={styles.container}>
      <FlatList
        style={styles.flatList}
        data={LIST_DATA}
        keyExtractor={(item) => item.id}
        testID="demo-app-flat-list"
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <Text style={[styles.listItemText, isDarkMode && styles.textDark]}>{item.title}</Text>
            <Pressable
              style={({ pressed }) => [styles.inListButton, pressed && styles.inListButtonPressed]}
              onPress={() => setTaps((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))}
              testID={`demo-app-flat-list-btn-${item.id}`}
            >
              <Text style={styles.inListButtonText}>탭: {taps[item.id] ?? 0}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  textDark: { color: '#fff' },
  inListButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  inListButtonPressed: { opacity: 0.8 },
  inListButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});
