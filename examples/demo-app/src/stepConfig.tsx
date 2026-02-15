/**
 * 스텝별 Q(질문) + 컴포넌트 정의.
 * 한 화면에 한 과제만 두어 테스트 검증을 명확히 함. 제스처·네트워크 등은 여러 스텝으로 분할.
 */

import React from 'react';
import { StepPressTestId } from './steps/StepPressTestId';
import { StepPressNoTestId } from './steps/StepPressNoTestId';
import { StepPressVariants } from './steps/StepPressVariants';
import { StepPressLongPress } from './steps/StepPressLongPress';
import { StepInputWithTestId } from './steps/StepInputWithTestId';
import { StepInputNoTestId } from './steps/StepInputNoTestId';
import { StepScrollNoRef } from './steps/StepScrollNoRef';
import { StepScrollWithRef } from './steps/StepScrollWithRef';
import { StepScrollNoTestId } from './steps/StepScrollNoTestId';
import { StepFlatListWithId } from './steps/StepFlatListWithId';
import { StepFlatListNoId } from './steps/StepFlatListNoId';
import { StepWebViewInline } from './steps/StepWebViewInline';
import { StepWebViewGoogle } from './steps/StepWebViewGoogle';
import { StepWebViewNoTestId } from './steps/StepWebViewNoTestId';
import { StepNetworkGet } from './steps/StepNetworkGet';
import { StepNetworkPost } from './steps/StepNetworkPost';
import { StepNetworkMultiple } from './steps/StepNetworkMultiple';
import { StepNetworkError } from './steps/StepNetworkError';
import { StepNetworkXhr } from './steps/StepNetworkXhr';
import { StepGestureCompare } from './steps/StepGestureCompare';
import { StepGestureTap } from './steps/StepGestureTap';
import { StepGestureGhPressable } from './steps/StepGestureGhPressable';
import { StepGestureGhNoId } from './steps/StepGestureGhNoId';
import { StepGestureReanimated } from './steps/StepGestureReanimated';
import { StepGestureReanimatedNoId } from './steps/StepGestureReanimatedNoId';
import { StepGestureReanimatedScroll } from './steps/StepGestureReanimatedScroll';
import { StepGestureSwipeable } from './steps/StepGestureSwipeable';
import { StepGestureRefresh } from './steps/StepGestureRefresh';
import { StepGestureDrawer } from './steps/StepGestureDrawer';
import { StepGesturePager } from './steps/StepGesturePager';
import { StepGestureBottomSheet } from './steps/StepGestureBottomSheet';

export type StepContentProps = { isDarkMode: boolean };

export type StepItem = {
  question: string;
  Component: React.ComponentType<StepContentProps>;
};

export const STEPS: StepItem[] = [
  // Press (4)
  {
    question: 'testID 있는 버튼을 클릭해 카운트를 올리세요.',
    Component: StepPressTestId,
  },
  {
    question: '「testID 없음」 버튼을 보이는 텍스트(click_by_label)로 클릭하세요.',
    Component: StepPressNoTestId,
  },
  {
    question:
      'TouchableOpacity, TouchableHighlight, RN Button, 이미지 버튼, Icon+Label을 각각 클릭해 보세요.',
    Component: StepPressVariants,
  },
  {
    question: 'Long Press 버튼 두 개를 길게 눌러 보세요.',
    Component: StepPressLongPress,
  },
  // Input (2)
  {
    question: 'testID 있는 TextInput에 type_text로 텍스트를 입력하세요.',
    Component: StepInputWithTestId,
  },
  {
    question: 'testID 없는 TextInput에 텍스트를 입력하세요.',
    Component: StepInputNoTestId,
  },
  // ScrollView (3)
  {
    question: 'ScrollView(testID, ref 없음)를 스크롤한 뒤 버튼 0~3을 클릭하세요.',
    Component: StepScrollNoRef,
  },
  {
    question: 'ScrollView(testID, ref 있음)를 스크롤한 뒤 버튼 4~7을 클릭하세요.',
    Component: StepScrollWithRef,
  },
  {
    question: 'testID 없는 ScrollView를 스크롤한 뒤 버튼을 클릭하세요.',
    Component: StepScrollNoTestId,
  },
  // FlatList (2)
  {
    question:
      'FlatList(testID 있음)를 스크롤한 뒤 특정 항목의 「탭」 버튼을 click(uid)로 클릭하세요.',
    Component: StepFlatListWithId,
  },
  {
    question: 'FlatList(testID 없음)를 스크롤한 뒤 click_by_label로 버튼을 클릭하세요.',
    Component: StepFlatListNoId,
  },
  // WebView (3)
  {
    question: '인라인 HTML WebView 안의 「WebView 내부 버튼」을 클릭하세요.',
    Component: StepWebViewInline,
  },
  {
    question: 'https://google.com WebView에서 webview_evaluate_script 등을 테스트하세요.',
    Component: StepWebViewGoogle,
  },
  {
    question: 'testID 없는 WebView 화면을 확인하세요. (getRegisteredWebViewIds에 미포함)',
    Component: StepWebViewNoTestId,
  },
  // Network (5)
  {
    question: 'GET /posts/1 버튼을 누른 뒤 list_network_requests에서 요청을 확인하세요.',
    Component: StepNetworkGet,
  },
  {
    question: 'POST /posts 버튼을 누른 뒤 네트워크 목록을 확인하세요.',
    Component: StepNetworkPost,
  },
  {
    question: 'Multiple (3 requests) 버튼을 눌러 3건 요청 후 목록을 확인하세요.',
    Component: StepNetworkMultiple,
  },
  {
    question: 'GET /posts/99999 (404) 버튼을 눌러 에러 응답을 확인하세요.',
    Component: StepNetworkError,
  },
  {
    question: 'XHR GET /albums/1 버튼을 눌러 list_network_requests에서 XHR을 확인하세요.',
    Component: StepNetworkXhr,
  },
  // Gesture (12)
  {
    question:
      'RN TouchableOpacity / Pressable / RNGH TouchableOpacity를 각각 클릭해 카운트를 확인하세요.',
    Component: StepGestureCompare,
  },
  {
    question: 'Gesture.Tap() 영역을 탭해 보세요. (네이티브 제스처라 MCP 터치 시 미동작할 수 있음)',
    Component: StepGestureTap,
  },
  {
    question: 'RNGH TouchableOpacity(testID 있음) 버튼을 클릭하세요.',
    Component: StepGestureGhPressable,
  },
  {
    question: 'RNGH 라벨만(testID 없음) 버튼을 click_by_label로 클릭하세요.',
    Component: StepGestureGhNoId,
  },
  {
    question: 'Reanimated 스케일 박스(testID 있음)를 눌러 보세요.',
    Component: StepGestureReanimated,
  },
  {
    question: 'Reanimated 스케일(라벨만) 「눌러보세요 (라벨만)」을 클릭하세요.',
    Component: StepGestureReanimatedNoId,
  },
  {
    question: 'Reanimated ScrollView를 스크롤해 보세요.',
    Component: StepGestureReanimatedScroll,
  },
  {
    question: 'Swipeable 행을 스와이프해 삭제 영역을 노출하세요.',
    Component: StepGestureSwipeable,
  },
  {
    question: '위에서 당겨 Pull to refresh를 트리거하세요.',
    Component: StepGestureRefresh,
  },
  {
    question:
      '「Drawer 열기」 버튼을 누르거나 왼쪽 가장자리에서 스와이프해 Drawer를 열고 닫기 버튼으로 닫으세요.',
    Component: StepGestureDrawer,
  },
  {
    question: '가로 스와이프로 페이지 1/2/3을 전환하고 현재 페이지 텍스트를 확인하세요.',
    Component: StepGesturePager,
  },
  {
    question: '하단 시트를 위로 드래그해 열고, 상태 텍스트를 확인하세요.',
    Component: StepGestureBottomSheet,
  },
];
