/**
 * React Native MCP 데모 앱
 * 하단 탭: ScrollView / FlatList / WebView
 * @format
 */

import React from 'react';
import { StyleSheet, View, useColorScheme, StatusBar } from 'react-native';
import { ScrollViewScreen } from './screens/ScrollViewScreen';
import { FlatListScreen } from './screens/FlatListScreen';
import { WebViewScreen } from './screens/WebViewScreen';
import { TabBar, type TabId } from './components/TabBar';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [activeTab, setActiveTab] = React.useState<TabId>('scroll');

  const [count, setCount] = React.useState(0);
  const [noTestIdTaps, setNoTestIdTaps] = React.useState(0);
  const [dynamicLabelTaps, setDynamicLabelTaps] = React.useState(0);
  const dynamicButtonLabel = `StateOnly-${dynamicLabelTaps}`;
  const [touchableOpacityTaps, setTouchableOpacityTaps] = React.useState(0);
  const [touchableHighlightTaps, setTouchableHighlightTaps] = React.useState(0);
  const [rnButtonTaps, setRnButtonTaps] = React.useState(0);
  const [imageOnlyTaps, setImageOnlyTaps] = React.useState(0);
  const [iconLabelTaps, setIconLabelTaps] = React.useState(0);
  const [noTestIdScrollTaps1, setNoTestIdScrollTaps1] = React.useState(0);
  const [noTestIdScrollTaps2, setNoTestIdScrollTaps2] = React.useState(0);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        {activeTab === 'scroll' && (
          <ScrollViewScreen
            isDarkMode={isDarkMode}
            count={count}
            setCount={setCount}
            noTestIdTaps={noTestIdTaps}
            setNoTestIdTaps={setNoTestIdTaps}
            setDynamicLabelTaps={setDynamicLabelTaps}
            dynamicButtonLabel={dynamicButtonLabel}
            touchableOpacityTaps={touchableOpacityTaps}
            setTouchableOpacityTaps={setTouchableOpacityTaps}
            touchableHighlightTaps={touchableHighlightTaps}
            setTouchableHighlightTaps={setTouchableHighlightTaps}
            rnButtonTaps={rnButtonTaps}
            setRnButtonTaps={setRnButtonTaps}
            imageOnlyTaps={imageOnlyTaps}
            setImageOnlyTaps={setImageOnlyTaps}
            iconLabelTaps={iconLabelTaps}
            setIconLabelTaps={setIconLabelTaps}
            noTestIdScrollTaps1={noTestIdScrollTaps1}
            setNoTestIdScrollTaps1={setNoTestIdScrollTaps1}
            noTestIdScrollTaps2={noTestIdScrollTaps2}
            setNoTestIdScrollTaps2={setNoTestIdScrollTaps2}
          />
        )}
        {activeTab === 'list' && <FlatListScreen isDarkMode={isDarkMode} />}
        {activeTab === 'webview' && <WebViewScreen isDarkMode={isDarkMode} />}
      </View>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} isDarkMode={isDarkMode} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  containerDark: { backgroundColor: '#1a1a1a' },
  content: { flex: 1 },
});

export default App;
