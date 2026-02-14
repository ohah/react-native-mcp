/**
 * 하단 탭 바 — ScrollView / FlatList 전환
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

export type TabId = 'scroll' | 'list' | 'webview';

export type TabBarProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isDarkMode: boolean;
};

export function TabBar({ activeTab, onTabChange, isDarkMode }: TabBarProps) {
  return (
    <View style={[styles.tabBar, isDarkMode && styles.tabBarDark]}>
      <Pressable
        style={[styles.tab, activeTab === 'scroll' && styles.tabActive]}
        onPress={() => onTabChange('scroll')}
        testID="demo-app-tab-scroll"
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'scroll' && styles.tabTextActive,
            isDarkMode && styles.textDark,
          ]}
        >
          ScrollView
        </Text>
      </Pressable>
      <Pressable
        style={[styles.tab, activeTab === 'list' && styles.tabActive]}
        onPress={() => onTabChange('list')}
        testID="demo-app-tab-list"
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'list' && styles.tabTextActive,
            isDarkMode && styles.textDark,
          ]}
        >
          FlatList
        </Text>
      </Pressable>
      <Pressable
        style={[styles.tab, activeTab === 'webview' && styles.tabActive]}
        onPress={() => onTabChange('webview')}
        testID="demo-app-tab-webview"
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'webview' && styles.tabTextActive,
            isDarkMode && styles.textDark,
          ]}
        >
          WebView
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  tabBarDark: { backgroundColor: '#2a2a2a', borderTopColor: '#444' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#0066cc' },
  tabText: { fontSize: 15, fontWeight: '500', color: '#333' },
  tabTextActive: { color: '#0066cc', fontWeight: '600' },
  textDark: { color: '#fff' },
});
