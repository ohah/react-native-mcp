/**
 * React Native MCP 데모 앱
 * 하단 탭: Scroll / Press / Input / FlatList / WebView / Network / Gesture
 * @format
 */

import React from 'react';
import { StyleSheet, View, useColorScheme, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ScrollViewScreen } from './screens/ScrollViewScreen';
import { PressScreen } from './screens/PressScreen';
import { InputScreen } from './screens/InputScreen';
import { FlatListScreen } from './screens/FlatListScreen';
import { WebViewScreen } from './screens/WebViewScreen';
import { NetworkScreen } from './screens/NetworkScreen';
import { GestureScreen } from './screens/GestureScreen';
import { TabBar, type TabId } from './components/TabBar';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [activeTab, setActiveTab] = React.useState<TabId>('scroll');

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.content}>
          {activeTab === 'scroll' && <ScrollViewScreen isDarkMode={isDarkMode} />}
          {activeTab === 'press' && <PressScreen isDarkMode={isDarkMode} />}
          {activeTab === 'input' && <InputScreen isDarkMode={isDarkMode} />}
          {activeTab === 'list' && <FlatListScreen isDarkMode={isDarkMode} />}
          {activeTab === 'webview' && <WebViewScreen isDarkMode={isDarkMode} />}
          {activeTab === 'network' && <NetworkScreen isDarkMode={isDarkMode} />}
          {activeTab === 'gesture' && <GestureScreen isDarkMode={isDarkMode} />}
        </View>
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} isDarkMode={isDarkMode} />
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
