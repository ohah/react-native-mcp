/**
 * React Native MCP 데모 앱
 * MCP 서버 연동·테스트용 단일 화면
 * @format
 */

import React from 'react';
import { StyleSheet, Text, View, useColorScheme, StatusBar, Pressable } from 'react-native';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [count, setCount] = React.useState(0);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Text style={[styles.title, isDarkMode && styles.textDark]} testID="demo-app-title">
        React Native MCP Demo
      </Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]} testID="demo-app-subtitle">
        MCP 서버 테스트용 예제 앱
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setCount((c) => c + 1)}
        testID="demo-app-counter-button"
      >
        <Text style={styles.buttonText}>Count: {count}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
  },
  textDark: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
    color: '#333',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
