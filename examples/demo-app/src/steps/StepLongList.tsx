import React from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';

export type StepProps = { isDarkMode: boolean };

const DATA = Array.from({ length: 100 }, (_, i) => ({ id: String(i), label: `아이템 ${i}` }));

export function StepLongList({ isDarkMode }: StepProps) {
  const [tapped, setTapped] = React.useState<string | null>(null);

  return (
    <View style={styles.container}>
      {tapped != null && (
        <Text style={[styles.status, isDarkMode && styles.darkText]} testID="long-list-status">
          탭: {tapped}
        </Text>
      )}
      <FlatList
        testID="long-list"
        data={DATA}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Pressable
            testID={`long-list-item-${index}`}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => setTapped(item.label)}
          >
            <Text style={[styles.itemText, isDarkMode && styles.darkText]}>{item.label}</Text>
          </Pressable>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  status: { fontSize: 14, color: '#333', marginBottom: 8, textAlign: 'center' },
  list: { flex: 1 },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemPressed: { backgroundColor: '#f0f0f0' },
  itemText: { fontSize: 14, color: '#333' },
  darkText: { color: '#ccc' },
});
