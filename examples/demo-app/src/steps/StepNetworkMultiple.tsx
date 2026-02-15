import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepNetworkMultiple({ isDarkMode }: StepProps) {
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const fetchMultiple = async () => {
    setLoading(true);
    setDone(false);
    try {
      await Promise.all([
        fetch('https://jsonplaceholder.typicode.com/users/1'),
        fetch('https://jsonplaceholder.typicode.com/todos/1'),
        fetch('https://jsonplaceholder.typicode.com/comments?postId=1'),
      ]);
      setDone(true);
    } catch {
      setDone(true);
    }
    setLoading(false);
  };
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={fetchMultiple}
          testID="network-fetch-multiple"
        >
          <Text style={styles.buttonText}>{loading ? '요청 중...' : 'Multiple (3 requests)'}</Text>
        </Pressable>
        {done && (
          <Text style={[styles.result, isDarkMode && styles.textDark]}>
            list_network_requests에서 3건 확인
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  container: { justifyContent: 'center', alignItems: 'center' },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: '#6600cc',
    borderRadius: 12,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  result: { marginTop: 16, fontSize: 14, color: '#666' },
  textDark: { color: '#fff' },
});
