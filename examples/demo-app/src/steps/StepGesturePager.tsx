import React from 'react';
import { StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';

export type StepProps = { isDarkMode: boolean };

export function StepGesturePager({ isDarkMode }: StepProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [currentPage, setCurrentPage] = React.useState(1);
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth) + 1;
          setCurrentPage(page);
        }}
      >
        <View
          style={[styles.pagerPage, { width: screenWidth }, isDarkMode && styles.pagerPageDark]}
        >
          <Text style={[styles.pagerText, isDarkMode && styles.textDark]}>페이지 1</Text>
        </View>
        <View
          style={[styles.pagerPage, { width: screenWidth }, isDarkMode && styles.pagerPageDark]}
        >
          <Text style={[styles.pagerText, isDarkMode && styles.textDark]}>페이지 2</Text>
        </View>
        <View
          style={[styles.pagerPage, { width: screenWidth }, isDarkMode && styles.pagerPageDark]}
        >
          <Text style={[styles.pagerText, isDarkMode && styles.textDark]}>페이지 3</Text>
        </View>
      </ScrollView>
      <Text testID="pager-status" style={[styles.pagerStatus, isDarkMode && styles.textDark]}>
        현재 페이지: {currentPage} / 3
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  pager: { marginHorizontal: -24 },
  pagerContent: {},
  pagerPage: {
    height: 120,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagerPageDark: { backgroundColor: '#333' },
  pagerText: { fontSize: 16, color: '#000' },
  textDark: { color: '#fff' },
  pagerStatus: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16 },
});
