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
      'AI: query_selector(또는 take_snapshot)로 testID "press-counter-button" 요소를 찾고, 반환된 measure로 좌표(pageX+width/2, pageY+height/2)를 얻은 뒤 tap(platform, x, y)으로 idb/adb 네이티브 클릭한다. 화면의 Count 숫자가 1 이상인지 assert_text로 확인하라.',
    Component: StepPressTestId,
  },
  {
    question:
      'AI: testID가 없으므로 query_selector로 :text("testID 없음") 등 요소를 찾고, measure로 좌표를 얻은 뒤 tap(platform, x, y)으로 idb/adb 클릭한다. 숫자가 증가했는지 확인하라.',
    Component: StepPressNoTestId,
  },
  {
    question:
      'AI: query_selector로 TouchableOpacity, TouchableHighlight, RN Button, 이미지 버튼, Icon+Label 등 각 버튼을 찾고, measure 좌표로 tap(platform, x, y)을 반복해 idb/adb로 클릭한다. 각 카운트가 1씩 증가했는지 확인하라.',
    Component: StepPressVariants,
  },
  {
    question:
      'AI: query_selector로 testID "press-long-press-button"과 "롱프레스 testID없음" 텍스트 요소를 찾아 각각 좌표를 얻고, tap(platform, x, y, duration)으로 idb/adb 롱프레스한다. 각 카운트가 증가했는지 확인하라.',
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
      'AI: scroll 도구로 testID "scroll-view-no-ref" ScrollView를 아래로 스크롤한 뒤, query_selector로 scroll-btn-0~29 중 하나(예: #scroll-btn-5)를 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. 해당 버튼 숫자가 증가했는지 확인하라.',
    Component: StepScrollNoRef,
  },
  {
    question:
      'AI: scroll 도구로 testID "scroll-view-with-ref" ScrollView를 스크롤한 뒤, query_selector로 scroll-btn-N을 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. 버튼 숫자 증가를 확인하라.',
    Component: StepScrollWithRef,
  },
  {
    question:
      'AI: testID 없는 ScrollView이므로 scroll(또는 swipe)로 스크롤한 뒤, query_selector로 :text("버튼 10") 등 버튼을 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. 해당 버튼 카운트가 올랐는지 확인하라.',
    Component: StepScrollNoTestId,
  },
  // FlatList (2)
  {
    question:
      'AI: scroll로 testID "demo-app-flat-list" FlatList를 스크롤한 뒤, query_selector로 demo-app-flat-list-btn-item-N(또는 "탭:" 텍스트) 요소를 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. "탭: N" 숫자가 1 이상인지 assert_text로 확인하라.',
    Component: StepFlatListWithId,
  },
  {
    question:
      'AI: testID 없는 FlatList를 스크롤한 뒤, query_selector로 :text("클릭:")가 포함된 버튼을 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. 해당 항목 숫자가 증가했는지 확인하라.',
    Component: StepFlatListNoId,
  },
  // WebView (3)
  {
    question:
      'AI: WebView 내부 DOM은 RN query_selector 좌표와 별개이므로, webview_evaluate_script(webViewId "demo-app-webview", script로 document.querySelector("button").click())로 내부 버튼을 클릭한다. 또는 query_selector로 WebView 영역을 찾아 measure 좌표로 tap(platform, x, y)을 해도 된다. "RN 탭 수: 1" 이상인지 확인하라.',
    Component: StepWebViewInline,
  },
  {
    question:
      'AI: getRegisteredWebViewIds로 등록된 WebView ID를 확인한 뒤, webview_evaluate_script(webViewId "demo-app-webview-google")로 document.title 등 스크립트를 실행해 결과를 확인하라.',
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
      'AI: query_selector로 testID "network-fetch-get" 버튼을 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭해 GET 요청을 보낸 뒤, list_network_requests로 /posts/1 요청·응답을 확인하라. 필요 시 assert_text로 "응답: 200"을 확인한다.',
    Component: StepNetworkGet,
  },
  {
    question:
      'AI: query_selector로 "network-fetch-post" 버튼을 찾아 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한 뒤 list_network_requests에서 POST /posts·status 201을 확인하라.',
    Component: StepNetworkPost,
  },
  {
    question:
      'AI: query_selector로 "network-fetch-multiple" 버튼을 찾아 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭해 3건 요청을 발생시킨 뒤 list_network_requests로 users/1, todos/1, comments 3건 수집 여부를 확인하라.',
    Component: StepNetworkMultiple,
  },
  {
    question:
      'AI: query_selector로 "network-fetch-error" 버튼을 찾아 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한 뒤 list_network_requests에서 404 요청을 확인하고, assert_text로 "응답: 404"를 검증하라.',
    Component: StepNetworkError,
  },
  {
    question:
      'AI: query_selector로 "network-xhr-get" 버튼을 찾아 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한 뒤 list_network_requests에서 XHR GET /albums/1 요청이 캡처됐는지 확인하라.',
    Component: StepNetworkXhr,
  },
  // Gesture (12)
  {
    question:
      'AI: query_selector로 gesture-compare-touchable, gesture-compare-pressable, gesture-compare-gh-touchable을 각각 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. 각 버튼 카운트가 1씩 올랐는지 확인하라.',
    Component: StepGestureCompare,
  },
  {
    question:
      'AI: query_selector로 testID "gesture-tap-detector-wrapper" 영역을 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. (Gesture.Tap()은 네이티브 제스처라 MCP 터치로는 숫자가 안 올라갈 수 있음 — 동작 여부만 확인하면 됨)',
    Component: StepGestureTap,
  },
  {
    question:
      'AI: query_selector로 testID "gesture-gh-pressable" 버튼을 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한 뒤 "RNGH TouchableOpacity: 1" 이상인지 확인하라.',
    Component: StepGestureGhPressable,
  },
  {
    question:
      'AI: testID가 없으므로 query_selector로 :text("RNGH 라벨만") 요소를 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한다. 숫자가 증가했는지 확인하라.',
    Component: StepGestureGhNoId,
  },
  {
    question:
      'AI: query_selector로 testID "gesture-reanimated-trigger" 또는 "gesture-reanimated-box"를 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한 뒤 "눌러보세요" 아래 숫자가 1 이상인지 확인하라.',
    Component: StepGestureReanimated,
  },
  {
    question:
      'AI: query_selector로 :text("눌러보세요 (라벨만)") 요소를 찾아 measure 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭한 뒤 Reanimated 스케일 박스 숫자가 올랐는지 확인하라.',
    Component: StepGestureReanimatedNoId,
  },
  {
    question:
      'AI: scroll 도구로 testID "gesture-reanimated-scroll" Animated.ScrollView를 아래로 스크롤하고, "Reanimated 목록 아이템 30" 등 하단 아이템이 보이거나 스크롤 가능함을 확인하라.',
    Component: StepGestureReanimatedScroll,
  },
  {
    question:
      'AI: query_selector로 "스와이프 to delete 행 1" 등 행 요소를 찾아 measure로 위치를 얻고, swipe(platform, x1, y1, x2, y2)로 idb/adb 왼쪽 스와이프해 "삭제" 영역이 노출되는지 확인하라.',
    Component: StepGestureSwipeable,
  },
  {
    question:
      'AI: 화면 상단 근처 좌표에서 아래 방향 swipe(platform, x1, y1, x2, y2)로 idb/adb 스와이프해 Pull to refresh를 트리거하고, "새로고침 횟수: 1" 이상인지 assert_text로 확인하라.',
    Component: StepGestureRefresh,
  },
  {
    question:
      'AI: query_selector로 testID "gesture-drawer-open" 버튼을 찾아 좌표를 얻고, tap(platform, x, y)으로 idb/adb 클릭해 Drawer를 연 뒤 assert_text로 "드로워: 열림"을 확인한다. "닫기" 버튼 또는 drawer-overlay를 query_selector로 찾아 tap으로 닫고 "닫힘"을 확인하라.',
    Component: StepGestureDrawer,
  },
  {
    question:
      'AI: query_selector로 페이저 영역 좌표를 얻고, 가로 swipe(platform, x1, y1, x2, y2)로 idb/adb 스와이프해 페이지를 전환한 뒤, assert_text 또는 query_selector로 "현재 페이지: 1/2/3" 텍스트(pager-status)를 확인하라.',
    Component: StepGesturePager,
  },
  {
    question:
      'AI: 하단 Bottom sheet 영역 좌표를 얻고, swipe(platform, x1, y1, x2, y2)로 idb/adb 위쪽 스와이프해 시트를 연 뒤, assert_text로 testID "sheet-status" 또는 "상태: 열림"을 확인하라.',
    Component: StepGestureBottomSheet,
  },
];
