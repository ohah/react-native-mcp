/**
 * 하단 탭 바 — Scroll / Press / Input / FlatList / WebView
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

export type TabId = 'scroll' | 'press' | 'input' | 'list' | 'webview' | 'network' | 'gesture';

const tabs: { id: TabId; label: string; testID: string }[] = [
  { id: 'scroll', label: 'Scroll', testID: 'tab-scroll' },
  { id: 'press', label: 'Press', testID: 'tab-press' },
  { id: 'input', label: 'Input', testID: 'tab-input' },
  { id: 'list', label: 'List', testID: 'tab-list' },
  { id: 'webview', label: 'WebView', testID: 'tab-webview' },
  { id: 'network', label: 'Network', testID: 'tab-network' },
  { id: 'gesture', label: 'Gesture', testID: 'tab-gesture' },
];

export type TabBarProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isDarkMode: boolean;
};

export function TabBar({ activeTab, onTabChange, isDarkMode }: TabBarProps) {
  return (
    <View style={[styles.tabBar, isDarkMode && styles.tabBarDark]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          onPress={() => onTabChange(tab.id)}
          testID={tab.testID}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab.id && styles.tabTextActive,
              isDarkMode && styles.textDark,
            ]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
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
  tabText: { fontSize: 11, fontWeight: '500', color: '#333' },
  tabTextActive: { color: '#0066cc', fontWeight: '600' },
  textDark: { color: '#fff' },
});
