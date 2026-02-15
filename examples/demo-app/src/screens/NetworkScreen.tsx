/**
 * Network 탭 — fetch/XHR 요청 예제
 * MCP 도구: list_network_requests, clear_network_requests
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

export type NetworkScreenProps = {
  isDarkMode: boolean;
};

type RequestResult = {
  id: number;
  method: string;
  url: string;
  status: number | null;
  body: string | null;
  error: string | null;
};

let nextId = 0;

export function NetworkScreen({ isDarkMode }: NetworkScreenProps) {
  const [results, setResults] = React.useState<RequestResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  const addResult = (r: Omit<RequestResult, 'id'>) => {
    nextId++;
    setResults((prev) => [{ ...r, id: nextId }, ...prev].slice(0, 20));
  };

  const fetchGet = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      const json = await res.json();
      addResult({
        method: 'GET',
        url: 'jsonplaceholder/posts/1',
        status: res.status,
        body: JSON.stringify(json).slice(0, 100),
        error: null,
      });
    } catch (e) {
      addResult({
        method: 'GET',
        url: 'jsonplaceholder/posts/1',
        status: null,
        body: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    setLoading(false);
  };

  const fetchPost = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'MCP Test', body: 'Hello from MCP', userId: 1 }),
      });
      const json = await res.json();
      addResult({
        method: 'POST',
        url: 'jsonplaceholder/posts',
        status: res.status,
        body: JSON.stringify(json).slice(0, 100),
        error: null,
      });
    } catch (e) {
      addResult({
        method: 'POST',
        url: 'jsonplaceholder/posts',
        status: null,
        body: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    setLoading(false);
  };

  const fetchMultiple = async () => {
    setLoading(true);
    try {
      const urls = [
        'https://jsonplaceholder.typicode.com/users/1',
        'https://jsonplaceholder.typicode.com/todos/1',
        'https://jsonplaceholder.typicode.com/comments?postId=1',
      ];
      const responses = await Promise.all(urls.map((u) => fetch(u)));
      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const json = await res.json();
        addResult({
          method: 'GET',
          url: urls[i].replace('https://jsonplaceholder.typicode.com/', ''),
          status: res.status,
          body: JSON.stringify(json).slice(0, 80),
          error: null,
        });
      }
    } catch (e) {
      addResult({
        method: 'GET',
        url: 'multiple',
        status: null,
        body: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    setLoading(false);
  };

  const fetchError = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts/99999');
      addResult({
        method: 'GET',
        url: 'posts/99999',
        status: res.status,
        body: null,
        error: res.ok ? null : `${res.status} ${res.statusText}`,
      });
    } catch (e) {
      addResult({
        method: 'GET',
        url: 'posts/99999',
        status: null,
        body: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    setLoading(false);
  };

  const xhrGet = () => {
    setLoading(true);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/albums/1');
    xhr.addEventListener('load', () => {
      addResult({
        method: 'XHR GET',
        url: 'albums/1',
        status: xhr.status,
        body: xhr.responseText.slice(0, 100),
        error: null,
      });
      setLoading(false);
    });
    xhr.addEventListener('error', () => {
      addResult({
        method: 'XHR GET',
        url: 'albums/1',
        status: null,
        body: null,
        error: 'Network error',
      });
      setLoading(false);
    });
    xhr.send();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDarkMode && styles.textDark]}>Network</Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
        list_network_requests, clear_network_requests
      </Text>

      <ScrollView
        style={styles.scrollBlock}
        contentContainerStyle={styles.scrollBlockContent}
        testID="network-screen-scroll"
      >
        {/* --- fetch 요청 버튼들 --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>fetch 요청</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={fetchGet}
          testID="network-fetch-get"
        >
          <Text style={styles.buttonText}>GET /posts/1</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonPost,
            pressed && styles.buttonPressed,
          ]}
          onPress={fetchPost}
          testID="network-fetch-post"
        >
          <Text style={styles.buttonText}>POST /posts</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonMultiple,
            pressed && styles.buttonPressed,
          ]}
          onPress={fetchMultiple}
          testID="network-fetch-multiple"
        >
          <Text style={styles.buttonText}>Multiple (3 requests)</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonError,
            pressed && styles.buttonPressed,
          ]}
          onPress={fetchError}
          testID="network-fetch-error"
        >
          <Text style={styles.buttonText}>GET /posts/99999 (404)</Text>
        </Pressable>

        {/* --- XHR 요청 --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>XMLHttpRequest</Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonXhr,
            pressed && styles.buttonPressed,
          ]}
          onPress={xhrGet}
          testID="network-xhr-get"
        >
          <Text style={styles.buttonText}>XHR GET /albums/1</Text>
        </Pressable>

        {/* --- 결과 표시 --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          Results {loading ? '(loading...)' : `(${results.length})`}
        </Text>
        {results.map((r) => (
          <View key={r.id} style={[styles.resultCard, isDarkMode && styles.resultCardDark]}>
            <Text style={[styles.resultMethod, r.error ? styles.resultError : null]}>
              {r.method} → {r.status ?? 'ERR'}
            </Text>
            <Text style={[styles.resultUrl, isDarkMode && styles.textDark]} numberOfLines={1}>
              {r.url}
            </Text>
            {r.body ? (
              <Text style={styles.resultBody} numberOfLines={2}>
                {r.body}
              </Text>
            ) : null}
            {r.error ? <Text style={styles.resultError}>{r.error}</Text> : null}
          </View>
        ))}
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
  scrollBlockContent: { paddingVertical: 8, paddingBottom: 24, alignItems: 'center' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    marginTop: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonPost: { backgroundColor: '#cc6600' },
  buttonMultiple: { backgroundColor: '#6600cc' },
  buttonError: { backgroundColor: '#cc0066' },
  buttonXhr: { backgroundColor: '#006644' },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultCard: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  resultCardDark: { backgroundColor: '#2a2a2a' },
  resultMethod: { fontSize: 14, fontWeight: '700', color: '#0066cc' },
  resultUrl: { fontSize: 12, color: '#666', marginTop: 2 },
  resultBody: { fontSize: 11, color: '#888', marginTop: 4, fontFamily: 'monospace' },
  resultError: { color: '#c00', fontSize: 12, marginTop: 2 },
});
