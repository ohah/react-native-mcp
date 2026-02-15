/**
 * React Native MCP 데모 앱 — 스텝별 Q&A 형식
 * 한 화면에 한 과제만 노출해 테스트/AI 검증을 명확히 함.
 * @format
 */

import React from 'react';
import { StyleSheet, View, useColorScheme, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StepLayout } from './components/StepLayout';
import { StepNav } from './components/StepNav';
import { STEPS } from './stepConfig';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [stepIndex, setStepIndex] = React.useState(0);
  const step = STEPS[stepIndex];
  const StepContent = step.Component;

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.content}>
          <StepLayout
            stepIndex={stepIndex}
            totalSteps={STEPS.length}
            question={step.question}
            isDarkMode={isDarkMode}
          >
            <StepContent isDarkMode={isDarkMode} />
          </StepLayout>
        </View>
        <StepNav
          stepIndex={stepIndex}
          totalSteps={STEPS.length}
          onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
          onNext={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
          isDarkMode={isDarkMode}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
  containerDark: { backgroundColor: '#1a1a1a' },
  content: { flex: 1 },
});

export default App;
