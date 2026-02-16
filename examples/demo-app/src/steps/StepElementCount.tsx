import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepElementCount({ isDarkMode }: StepProps) {
  const [items, setItems] = React.useState([0, 1, 2, 3, 4]);

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i !== id));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        testID="element-count-scroll"
      >
        <Text style={[styles.status, isDarkMode && styles.darkText]} testID="element-count-status">
          남은 아이템: {items.length}
        </Text>

        {items.map((id) => (
          <Pressable
            key={id}
            testID={`count-item-${id}`}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => removeItem(id)}
          >
            <Text style={styles.itemText}>아이템 {id} (탭하면 삭제)</Text>
          </Pressable>
        ))}

        {items.length === 0 && (
          <Text style={[styles.empty, isDarkMode && styles.darkText]}>모두 삭제됨</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8, paddingBottom: 24, alignItems: 'center' },
  status: { fontSize: 14, color: '#333', marginBottom: 12 },
  item: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemPressed: { opacity: 0.7 },
  itemText: { fontSize: 14, color: '#1565c0', fontWeight: '500' },
  empty: { fontSize: 14, color: '#999', marginTop: 16 },
  darkText: { color: '#ccc' },
});
