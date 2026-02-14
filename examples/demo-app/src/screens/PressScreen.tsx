/**
 * Press 탭 — 각종 버튼 타입 + long press 테스트
 * MCP 도구: click, click_by_label, long_press, long_press_by_label
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TouchableOpacity,
  TouchableHighlight,
  Button,
  Image,
  ScrollView,
} from 'react-native';

export type PressScreenProps = {
  isDarkMode: boolean;
};

export function PressScreen({ isDarkMode }: PressScreenProps) {
  const [count, setCount] = React.useState(0);
  const [noTestIdTaps, setNoTestIdTaps] = React.useState(0);
  const [touchableOpacityTaps, setTouchableOpacityTaps] = React.useState(0);
  const [touchableHighlightTaps, setTouchableHighlightTaps] = React.useState(0);
  const [rnButtonTaps, setRnButtonTaps] = React.useState(0);
  const [imageOnlyTaps, setImageOnlyTaps] = React.useState(0);
  const [iconLabelTaps, setIconLabelTaps] = React.useState(0);
  const [longPressCount, setLongPressCount] = React.useState(0);
  const [longPressNoIdCount, setLongPressNoIdCount] = React.useState(0);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDarkMode && styles.textDark]}>Press</Text>
      <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
        click, click_by_label, long_press, long_press_by_label
      </Text>

      <ScrollView
        style={styles.scrollBlock}
        contentContainerStyle={styles.scrollBlockContent}
        testID="press-screen-scroll"
      >
        {/* --- Click (testID 있음) --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          Pressable (testID 있음)
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => {
            setCount((c) => c + 1);
            console.log('[PressScreen] Counter pressed, count:', count + 1);
          }}
          testID="press-counter-button"
        >
          <Text style={styles.buttonText}>Count: {count}</Text>
        </Pressable>

        {/* --- Click (testID 없음) --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>
          Pressable (testID 없음)
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonNoTestId,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setNoTestIdTaps((n) => n + 1)}
        >
          <Text style={styles.buttonText}>testID 없음 ({noTestIdTaps})</Text>
        </Pressable>

        {/* --- 다양한 버튼 타입 --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>다양한 버튼 타입</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonTouchableOpacity]}
          onPress={() => setTouchableOpacityTaps((n) => n + 1)}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>TouchableOpacity ({touchableOpacityTaps})</Text>
        </TouchableOpacity>
        <TouchableHighlight
          style={[styles.button, styles.buttonTouchableHighlight]}
          onPress={() => setTouchableHighlightTaps((n) => n + 1)}
          underlayColor="#6a8"
        >
          <Text style={styles.buttonText}>TouchableHighlight ({touchableHighlightTaps})</Text>
        </TouchableHighlight>
        <View style={styles.buttonWrapper}>
          <Button
            title={`RN Button (${rnButtonTaps})`}
            onPress={() => setRnButtonTaps((n) => n + 1)}
          />
        </View>
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
        <Pressable
          style={[styles.button, styles.buttonIconLabel]}
          onPress={() => setIconLabelTaps((n) => n + 1)}
        >
          <Image
            source={{ uri: 'https://via.placeholder.com/20x20/486/fff?text=+' }}
            style={styles.iconImageSmall}
          />
          <Text style={styles.buttonText}>Icon + Label ({iconLabelTaps})</Text>
        </Pressable>

        {/* --- Long Press --- */}
        <Text style={[styles.sectionTitle, isDarkMode && styles.textDark]}>Long Press</Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonLongPress,
            pressed && styles.buttonPressed,
          ]}
          onLongPress={() => setLongPressCount((n) => n + 1)}
          testID="press-long-press-button"
        >
          <Text style={styles.buttonText}>Long Press ({longPressCount})</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonLongPress,
            pressed && styles.buttonPressed,
          ]}
          onLongPress={() => setLongPressNoIdCount((n) => n + 1)}
        >
          <Text style={styles.buttonText}>롱프레스 testID없음 ({longPressNoIdCount})</Text>
        </Pressable>
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
  },
  buttonNoTestId: { backgroundColor: '#884' },
  buttonTouchableOpacity: { backgroundColor: '#648' },
  buttonTouchableHighlight: { backgroundColor: '#486' },
  buttonImageOnly: { backgroundColor: '#846', padding: 12 },
  buttonIconLabel: { backgroundColor: '#684', flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonLongPress: { backgroundColor: '#864' },
  buttonWrapper: { marginTop: 8 },
  iconImage: { width: 24, height: 24 },
  iconImageSmall: { width: 20, height: 20 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
