import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepNetworkGet({ isDarkMode }: StepProps) {
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<number | null>(null);
  const fetchGet = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      setStatus(res.status);
    } catch {
      setStatus(-1);
    }
    setLoading(false);
  };
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={fetchGet}
          testID="network-fetch-get"
        >
          <Text style={styles.buttonText}>{loading ? '요청 중...' : 'GET /posts/1'}</Text>
        </Pressable>
        {status !== null && (
          <Text style={[styles.result, isDarkMode && styles.textDark]} testID="network-last-status">
            응답: {status === -1 ? 'ERR' : status}
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
    backgroundColor: '#0066cc',
    borderRadius: 12,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  result: { marginTop: 16, fontSize: 14, color: '#666' },
  textDark: { color: '#fff' },
});
