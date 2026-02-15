import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepNetworkXhr({ isDarkMode }: StepProps) {
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<number | null>(null);
  const xhrGet = () => {
    setLoading(true);
    setStatus(null);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/albums/1');
    xhr.addEventListener('load', () => {
      setStatus(xhr.status);
      setLoading(false);
    });
    xhr.addEventListener('error', () => {
      setStatus(-1);
      setLoading(false);
    });
    xhr.send();
  };
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={xhrGet}
          testID="network-xhr-get"
        >
          <Text style={styles.buttonText}>{loading ? '요청 중...' : 'XHR GET /albums/1'}</Text>
        </Pressable>
        {status !== null && (
          <Text style={[styles.result, isDarkMode && styles.textDark]}>
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
    backgroundColor: '#006644',
    borderRadius: 12,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  result: { marginTop: 16, fontSize: 14, color: '#666' },
  textDark: { color: '#fff' },
});
