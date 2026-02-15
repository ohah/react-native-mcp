/**
 * 스텝 이전/다음 네비게이션
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

export type StepNavProps = {
  stepIndex: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isDarkMode: boolean;
};

export function StepNav({ stepIndex, totalSteps, onPrev, onNext, isDarkMode }: StepNavProps) {
  const canPrev = stepIndex > 0;
  const canNext = stepIndex < totalSteps - 1;
  return (
    <View style={[styles.bar, isDarkMode && styles.barDark]}>
      <Pressable
        style={[styles.btn, !canPrev && styles.btnDisabled]}
        onPress={onPrev}
        disabled={!canPrev}
        testID="step-nav-prev"
      >
        <Text
          style={[
            styles.btnText,
            isDarkMode && styles.btnTextDark,
            !canPrev && styles.btnTextDisabled,
          ]}
        >
          이전
        </Text>
      </Pressable>
      <Text style={[styles.indicator, isDarkMode && styles.btnTextDark]}>
        {stepIndex + 1} / {totalSteps}
      </Text>
      <Pressable
        style={[styles.btn, !canNext && styles.btnDisabled]}
        onPress={onNext}
        disabled={!canNext}
        testID="step-nav-next"
      >
        <Text
          style={[
            styles.btnText,
            isDarkMode && styles.btnTextDark,
            !canNext && styles.btnTextDisabled,
          ]}
        >
          다음
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  barDark: { backgroundColor: '#2a2a2a', borderTopColor: '#444' },
  btn: { paddingVertical: 8, paddingHorizontal: 16, minWidth: 72, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontWeight: '600', color: '#0066cc' },
  btnTextDark: { color: '#fff' },
  btnTextDisabled: { color: '#888' },
  indicator: { fontSize: 13, fontWeight: '600', color: '#666' },
});
