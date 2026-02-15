import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

export type StepProps = { isDarkMode: boolean };

export function StepGestureSwipeable({ isDarkMode }: StepProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.swipeableList}>
          {[1, 2].map((i) => (
            <Swipeable
              key={i}
              renderRightActions={() => (
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  container: {},
  swipeableList: {},
  swipeableRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  swipeableRowDark: { backgroundColor: '#333' },
  swipeableRowText: { fontSize: 15, color: '#000' },
  textDark: { color: '#fff' },
  swipeableAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    backgroundColor: '#c44',
    borderRadius: 8,
    marginBottom: 8,
  },
  swipeableActionText: { color: '#fff', fontWeight: '600' },
});
