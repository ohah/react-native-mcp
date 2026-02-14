/**
 * Input 탭 — TextInput 테스트
 * MCP 도구: type_text
 */

import React from 'react';
import { StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';

export type InputScreenProps = {
  isDarkMode: boolean;
};

export function InputScreen({ isDarkMode }: InputScreenProps) {
  const [text1, setText1] = React.useState('');
  const [text2, setText2] = React.useState('');

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDarkMode && styles.textDark]}>Input</Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>type_text 도구 테스트</Text>

      <ScrollView
        style={styles.scrollBlock}
        contentContainerStyle={styles.scrollBlockContent}
        testID="input-screen-scroll"
      >
        {/* --- TextInput (testID 있음) --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          TextInput (testID 있음)
        </Text>
        <TextInput
          style={[styles.textInput, isDarkMode && styles.textInputDark]}
          testID="input-with-testid"
          placeholder="type_text 테스트"
          placeholderTextColor="#999"
          value={text1}
          onChangeText={setText1}
        />
        {text1 ? (
          <Text style={[styles.result, isDarkMode && styles.textDark]} testID="input-result-1">
            입력값: {text1}
          </Text>
        ) : null}

        {/* --- TextInput (testID 없음) --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          TextInput (testID 없음)
        </Text>
        <TextInput
          style={[styles.textInput, isDarkMode && styles.textInputDark]}
          placeholder="testID 없는 입력"
          placeholderTextColor="#999"
          value={text2}
          onChangeText={setText2}
        />
        {text2 ? (
          <Text style={[styles.result, isDarkMode && styles.textDark]}>입력값: {text2}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: '#000' },
  textDark: { color: '#fff' },
  subtitle: { fontSize: 13, marginBottom: 12, color: '#333' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6, color: '#333' },
  scrollBlock: { flex: 1 },
  scrollBlockContent: { paddingVertical: 8, paddingBottom: 24 },
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
});
