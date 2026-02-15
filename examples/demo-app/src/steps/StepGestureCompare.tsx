import React from 'react';
import { StyleSheet, View, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';

export type StepProps = { isDarkMode: boolean };

export function StepGestureCompare({ isDarkMode }: StepProps) {
  const [touchableTaps, setTouchableTaps] = React.useState(0);
  const [pressableTaps, setPressableTaps] = React.useState(0);
  const [ghTaps, setGhTaps] = React.useState(0);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.compareCol}>
        <TouchableOpacity
          style={[styles.compareBtn, styles.compareBtnTouchable]}
          onPress={() => setTouchableTaps((n) => n + 1)}
          testID="gesture-compare-touchable"
          activeOpacity={0.8}
        >
          <Text style={styles.compareBtnLabel}>RN TouchableOpacity</Text>
          <Text style={styles.compareBtnCount}>{touchableTaps}</Text>
        </TouchableOpacity>
        <Pressable
          style={({ pressed }) => [
            styles.compareBtn,
            styles.compareBtnPressable,
            pressed && styles.compareBtnPressed,
          ]}
          onPress={() => setPressableTaps((n) => n + 1)}
          testID="gesture-compare-pressable"
        >
          <Text style={styles.compareBtnLabel}>RN Pressable</Text>
          <Text style={styles.compareBtnCount}>{pressableTaps}</Text>
        </Pressable>
        <GHTouchableOpacity
          style={[styles.compareBtn, styles.compareBtnGh]}
          onPress={() => setGhTaps((n) => n + 1)}
          testID="gesture-compare-gh-touchable"
          activeOpacity={0.8}
        >
          <Text style={styles.compareBtnLabel}>RNGH TouchableOpacity</Text>
          <Text style={styles.compareBtnCount}>{ghTaps}</Text>
        </GHTouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  compareCol: { gap: 12 },
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
});
