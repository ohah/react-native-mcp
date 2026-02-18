import React from 'react';
import { StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepInputWithTestId({ isDarkMode }: StepProps) {
  const [text, setText] = React.useState('');
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* E2E Phase 3 copyText/pasteText: 이 텍스트를 복사해 input에 붙여넣기 검증 */}
      <Text style={[styles.copySource, isDarkMode && styles.textDark]} testID="e2e-copy-source">
        PASTE_ME
      </Text>
      <TextInput
        style={[styles.textInput, isDarkMode && styles.textInputDark]}
        testID="input-with-testid"
        placeholder="type_text 테스트"
        placeholderTextColor="#999"
        value={text}
        onChangeText={setText}
      />
      {text ? (
        <Text style={[styles.result, isDarkMode && styles.textDark]} testID="input-result-1">
          입력값: {text}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  textInput: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  textInputDark: { color: '#fff', backgroundColor: '#333', borderColor: '#555' },
  copySource: { marginBottom: 8, fontSize: 14, color: '#666' },
  result: { marginTop: 6, fontSize: 14, color: '#666' },
  textDark: { color: '#fff' },
});
