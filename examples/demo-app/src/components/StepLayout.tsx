/**
 * 스텝 화면 레이아웃 — Q(질문) + 과제 영역
 * AI/테스트 시 한 화면에 한 과제만 노출해 검증을 명확히 함.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type StepLayoutProps = {
  stepIndex: number;
  totalSteps: number;
  question: string;
  children: React.ReactNode;
  isDarkMode: boolean;
};

export function StepLayout({
  stepIndex,
  totalSteps,
  question,
  children,
  isDarkMode,
}: StepLayoutProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <Text style={[styles.stepBadge, isDarkMode && styles.textDark]}>
          Step {stepIndex + 1} / {totalSteps}
        </Text>
        <Text style={[styles.questionLine, isDarkMode && styles.textDark]}>
          <Text style={styles.labelQ}>Q </Text>
          {question}
        </Text>
      </View>
      <View style={styles.answerArea}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
  headerDark: { backgroundColor: '#252525', borderBottomColor: '#444' },
  stepBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  questionLine: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  labelQ: {
    fontWeight: '700',
    color: '#0066cc',
  },
  answerArea: { flex: 1 },
});
