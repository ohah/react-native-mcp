/**
 * React Native MCP 데모 앱
 * MCP 서버 연동·테스트용 단일 화면
 * @format
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  useColorScheme,
  StatusBar,
  Pressable,
  TouchableOpacity,
  TouchableHighlight,
  Button,
  Image,
} from 'react-native';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [count, setCount] = React.useState(0);
  const [noTestIdTaps, setNoTestIdTaps] = React.useState(0);
  // 트랜스파일 시점에 텍스트 추론 불가 — state로만 결정 (click_by_label 런타임 테스트용)
  const [dynamicLabelTaps, setDynamicLabelTaps] = React.useState(0);
  const dynamicButtonLabel = `StateOnly-${dynamicLabelTaps}`;
  const [touchableOpacityTaps, setTouchableOpacityTaps] = React.useState(0);
  const [touchableHighlightTaps, setTouchableHighlightTaps] = React.useState(0);
  const [rnButtonTaps, setRnButtonTaps] = React.useState(0);
  const [imageOnlyTaps, setImageOnlyTaps] = React.useState(0);
  const [iconLabelTaps, setIconLabelTaps] = React.useState(0);

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
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonSecondary,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => {
          console.log('[Demo] Console button pressed at', new Date().toISOString());
          console.warn('[Demo] Sample warning for MCP console monitoring');
        }}
        testID="demo-app-console-button"
      >
        <Text style={styles.buttonTextSecondary}>Console</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonSecondary,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => {
          fetch('https://httpbin.org/get?demo=1')
            .then((res) => res.json())
            .then((data) => console.log('[Demo] Network response:', data))
            .catch((err) => console.warn('[Demo] Network error:', err));
        }}
        testID="demo-app-network-button"
      >
        <Text style={styles.buttonTextSecondary}>Network</Text>
      </Pressable>
      {/* testID 없음 — Fiber pressByLabel(텍스트)로만 클릭 가능 */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonNoTestId,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => setNoTestIdTaps((n) => n + 1)}
      >
        <Text style={styles.buttonTextSecondary}>No testID ({noTestIdTaps})</Text>
      </Pressable>
      {/* 트랜스파일 시점에 텍스트 추론 불가: 표시 문자열이 전부 state */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonDynamicLabel,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => setDynamicLabelTaps((n) => n + 1)}
      >
        <Text style={styles.buttonTextSecondary}>{dynamicButtonLabel}</Text>
      </Pressable>
      {/* TouchableOpacity — testID 없음, click_by_label 테스트 */}
      <TouchableOpacity
        style={[styles.button, styles.buttonTouchableOpacity]}
        onPress={() => setTouchableOpacityTaps((n) => n + 1)}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonTextSecondary}>TouchableOpacity ({touchableOpacityTaps})</Text>
      </TouchableOpacity>
      {/* TouchableHighlight — testID 없음, click_by_label 테스트 */}
      <TouchableHighlight
        style={[styles.button, styles.buttonTouchableHighlight]}
        onPress={() => setTouchableHighlightTaps((n) => n + 1)}
        underlayColor="#6a8"
      >
        <Text style={styles.buttonTextSecondary}>
          TouchableHighlight ({touchableHighlightTaps})
        </Text>
      </TouchableHighlight>
      {/* Button (RN 기본) — testID 없음, click_by_label 테스트 */}
      <View style={styles.buttonWrapper}>
        <Button
          title={`RN Button (${rnButtonTaps})`}
          onPress={() => setRnButtonTaps((n) => n + 1)}
        />
      </View>
      {/* 이미지만 있는 버튼 — 텍스트 없음, accessibilityLabel으로 감지/클릭 */}
      <Pressable
        style={[styles.button, styles.buttonImageOnly]}
        onPress={() => setImageOnlyTaps((n) => n + 1)}
        accessibilityLabel={`Image only button (${imageOnlyTaps})`}
      >
        <Image
          source={{ uri: 'https://via.placeholder.com/24x24/648/fff?text=+' }}
          style={styles.iconImage}
          accessibilityLabel="Image only button"
        />
      </Pressable>
      {/* 이미지 + 텍스트 버튼 */}
      <Pressable
        style={[styles.button, styles.buttonIconLabel]}
        onPress={() => setIconLabelTaps((n) => n + 1)}
      >
        <Image
          source={{ uri: 'https://via.placeholder.com/20x20/486/fff?text=+' }}
          style={styles.iconImageSmall}
        />
        <Text style={styles.buttonTextSecondary}>Icon + Label ({iconLabelTaps})</Text>
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
    marginTop: 12,
  },
  buttonSecondary: {
    backgroundColor: '#444',
  },
  buttonNoTestId: {
    backgroundColor: '#884',
  },
  buttonDynamicLabel: {
    backgroundColor: '#468',
  },
  buttonTouchableOpacity: {
    backgroundColor: '#648',
  },
  buttonTouchableHighlight: {
    backgroundColor: '#486',
  },
  buttonWrapper: {
    marginTop: 12,
  },
  buttonImageOnly: {
    backgroundColor: '#846',
    padding: 12,
  },
  buttonIconLabel: {
    backgroundColor: '#684',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconImage: {
    width: 24,
    height: 24,
  },
  iconImageSmall: {
    width: 20,
    height: 20,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
