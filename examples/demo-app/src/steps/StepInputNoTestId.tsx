import React from 'react';
import { StyleSheet, Text, TextInput, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepInputNoTestId({ isDarkMode }: StepProps) {
  const [text, setText] = React.useState('');
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        style={[styles.textInput, isDarkMode && styles.textInputDark]}
        placeholder="testID 없는 입력"
        placeholderTextColor="#999"
        value={text}
        onChangeText={setText}
      />
      {text ? (
        <Text style={[styles.result, isDarkMode && styles.textDark]}>입력값: {text}</Text>
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
  result: { marginTop: 6, fontSize: 14, color: '#666' },
  textDark: { color: '#fff' },
});
