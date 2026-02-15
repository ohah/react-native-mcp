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
    question:
      'AI: query_selector 또는 take_snapshot으로 testID "press-counter-button"인 버튼을 찾고, tap(또는 click)으로 클릭한 뒤 화면의 Count 숫자가 1 이상 증가했는지 assert_text로 확인하라.',
    Component: StepPressTestId,
  },
  {
    question:
      'AI: testID가 없는 버튼이므로 query_selector로 텍스트 "testID 없음"을 포함한 요소를 찾거나 click_by_label을 사용해 해당 버튼을 누른 뒤, 숫자가 증가했는지 확인하라.',
    Component: StepPressNoTestId,
  },
  {
    question:
      'AI: TouchableOpacity, TouchableHighlight, RN Button, 이미지 버튼, Icon+Label 버튼을 각각 tap(또는 click)으로 눌러, 각 카운트가 1씩 증가하는지 확인하라. 필요 시 query_selector로 텍스트나 testID로 요소를 찾는다.',
    Component: StepPressVariants,
  },
  {
    question:
      'AI: long_press(또는 tap에 duration)로 testID "press-long-press-button" 버튼을 길게 누르고, "롱프레스 testID없음" 버튼은 라벨/좌표로 길게 눌러 각 카운트가 증가했는지 확인하라.',
    Component: StepPressLongPress,
  },
  // Input (2)
  {
    question:
      'AI: type_text 도구로 testID "input-with-testid"인 TextInput에 임의 문자열을 입력한 뒤, assert_text 또는 take_snapshot으로 "입력값: (입력한 문자열)"이 보이는지 확인하라.',
    Component: StepInputWithTestId,
  },
  {
    question:
      'AI: testID가 없는 TextInput이므로 query_selector로 placeholder "testID 없는 입력" 등으로 찾거나 uid를 얻어 type_text로 입력한 뒤, 화면에 "입력값:"이 표시되는지 확인하라.',
    Component: StepInputNoTestId,
  },
  // ScrollView (3)
  {
    question:
      'AI: scroll 도구로 testID "scroll-view-no-ref"인 ScrollView를 아래로 스크롤한 뒤, scroll-btn-0~29 중 하나(예: scroll-btn-5)를 query_selector·tap으로 클릭하고, 해당 버튼의 숫자가 증가했는지 확인하라.',
    Component: StepScrollNoRef,
  },
  {
    question:
      'AI: testID "scroll-view-with-ref" ScrollView를 scroll로 스크롤한 뒤, scroll-btn-0~29 중 하나를 tap(uid)으로 클릭하고 버튼 숫자 증가를 확인하라.',
    Component: StepScrollWithRef,
  },
  {
    question:
      'AI: testID 없는 ScrollView이므로 query_selector로 ScrollView 또는 버튼 텍스트(예: "버튼 10")를 찾아 scroll·tap을 수행한 뒤, 해당 버튼의 카운트가 올랐는지 확인하라.',
    Component: StepScrollNoTestId,
  },
  // FlatList (2)
  {
    question:
      'AI: testID "demo-app-flat-list"인 FlatList를 scroll로 스크롤한 뒤, demo-app-flat-list-btn-item-N 중 하나의 uid로 tap(또는 click)하여 "탭: N" 숫자가 1 이상인지 assert_text로 확인하라.',
    Component: StepFlatListWithId,
  },
  {
    question:
      'AI: testID 없는 FlatList를 스크롤한 뒤, click_by_label 또는 query_selector로 "클릭: N" 텍스트가 있는 버튼을 찾아 탭하고, 해당 항목의 숫자가 증가했는지 확인하라.',
    Component: StepFlatListNoId,
  },
  // WebView (3)
  {
    question:
      'AI: webview_evaluate_script(또는 해당 WebView용 클릭)로 webViewId "demo-app-webview" 내부의 "WebView 내부 버튼"을 클릭한 뒤, 화면에 "RN 탭 수: 1" 이상으로 표시되는지 확인하라.',
    Component: StepWebViewInline,
  },
  {
    question:
      'AI: getRegisteredWebViewIds로 등록된 WebView ID를 확인한 뒤, webview_evaluate_script로 testID "demo-app-webview-google" WebView 안에서 document.title 등 스크립트를 실행해 결과를 확인하라.',
    Component: StepWebViewGoogle,
  },
  {
    question:
      'AI: getRegisteredWebViewIds를 호출해 목록을 받고, testID 없는 이 WebView는 목록에 포함되지 않음을 확인하라. (화면에는 "testID 없음" WebView가 보인다.)',
    Component: StepWebViewNoTestId,
  },
  // Network (5)
  {
    question:
      'AI: tap으로 testID "network-fetch-get" 버튼을 눌러 GET 요청을 보낸 뒤, list_network_requests를 호출해 jsonplaceholder 또는 /posts/1 관련 요청이 잡혔는지 확인하라. 필요 시 assert_text로 "응답: 200"을 확인한다.',
    Component: StepNetworkGet,
  },
  {
    question:
      'AI: "network-fetch-post" 버튼을 tap한 뒤 list_network_requests에서 POST /posts 요청이 있는지, status 201 등이 반환되는지 확인하라.',
    Component: StepNetworkPost,
  },
  {
    question:
      'AI: "network-fetch-multiple" 버튼을 눌러 3건의 GET 요청을 발생시킨 뒤 list_network_requests로 users/1, todos/1, comments 관련 요청 3건이 수집됐는지 확인하라.',
    Component: StepNetworkMultiple,
  },
  {
    question:
      'AI: "network-fetch-error" 버튼을 눌러 404 요청을 보낸 뒤 list_network_requests에서 해당 요청과 status 404(또는 에러)를 확인하고, 화면에 "응답: 404"가 나오는지 assert_text로 검증하라.',
    Component: StepNetworkError,
  },
  {
    question:
      'AI: "network-xhr-get" 버튼을 tap해 XHR 요청을 보낸 뒤 list_network_requests에서 XHR GET /albums/1 요청이 캡처됐는지 확인하라.',
    Component: StepNetworkXhr,
  },
  // Gesture (12)
  {
    question:
      'AI: query_selector 또는 take_snapshot으로 gesture-compare-touchable, gesture-compare-pressable, gesture-compare-gh-touchable을 찾아 각각 tap한 뒤, 각 버튼의 카운트 숫자가 1씩 올랐는지 확인하라.',
    Component: StepGestureCompare,
  },
  {
    question:
      'AI: testID "gesture-tap-detector-wrapper" 영역을 tap한다. (Gesture.Tap()은 네이티브 제스처라 MCP 터치로는 숫자가 안 올라갈 수 있음 — 동작 여부만 확인하면 됨)',
    Component: StepGestureTap,
  },
  {
    question:
      'AI: query_selector 또는 uid로 testID "gesture-gh-pressable" 버튼을 찾아 tap하고, "RNGH TouchableOpacity: 1" 이상으로 표시되는지 확인하라.',
    Component: StepGestureGhPressable,
  },
  {
    question:
      'AI: testID가 없으므로 "RNGH 라벨만" 텍스트로 click_by_label(또는 query_selector :text)을 사용해 버튼을 누르고, 숫자가 증가했는지 확인하라.',
    Component: StepGestureGhNoId,
  },
  {
    question:
      'AI: testID "gesture-reanimated-trigger"(또는 gesture-reanimated-box)를 찾아 tap한 뒤, "눌러보세요" 아래 숫자가 1 이상인지 확인하라.',
    Component: StepGestureReanimated,
  },
  {
    question:
      'AI: "눌러보세요 (라벨만)" 텍스트를 가진 요소를 query_selector 또는 click_by_label로 찾아 탭하고, Reanimated 스케일 박스의 숫자가 올랐는지 확인하라.',
    Component: StepGestureReanimatedNoId,
  },
  {
    question:
      'AI: testID "gesture-reanimated-scroll"인 Animated.ScrollView에 scroll 도구를 사용해 아래로 스크롤하고, "Reanimated 목록 아이템 30" 등 하단 아이템이 보이거나 스크롤 가능함을 확인하라.',
    Component: StepGestureReanimatedScroll,
  },
  {
    question:
      'AI: swipe 도구로 "스와이프 to delete 행 1" 또는 "행 2" 행을 왼쪽으로 스와이프해 "삭제" 영역이 노출되는지 확인하라. (ReanimatedSwipeable 사용)',
    Component: StepGestureSwipeable,
  },
  {
    question:
      'AI: 화면 상단 근처에서 아래 방향 swipe(또는 scroll)로 Pull to refresh를 트리거하고, "새로고침 횟수: 1" 이상으로 바뀌었는지 assert_text로 확인하라.',
    Component: StepGestureRefresh,
  },
  {
    question:
      'AI: testID "gesture-drawer-open" 버튼을 tap해 Drawer를 연 뒤, assert_text로 "드로워: 열림" 또는 "drawer-status"를 확인한다. 그다음 "닫기" 버튼을 찾아 tap하거나 drawer-overlay를 탭해 닫고, "닫힘"이 보이는지 확인하라.',
    Component: StepGestureDrawer,
  },
  {
    question:
      'AI: 가로 swipe로 페이지를 전환한 뒤 assert_text 또는 query_selector로 "현재 페이지: 1 / 3", "2 / 3", "3 / 3" 중 해당 텍스트가 보이는지 확인하라. testID "pager-status"로 검증 가능.',
    Component: StepGesturePager,
  },
  {
    question:
      'AI: 하단 Bottom sheet 영역을 위로 스와이프(swipe 또는 좌표 tap/드래그)해 시트를 열고, assert_text로 testID "sheet-status" 또는 "상태: 열림"이 보이는지 확인하라.',
    Component: StepGestureBottomSheet,
  },
];
