export const querySelectorGuide = {
  name: 'query-selector-syntax',
  description:
    'query_selector / query_selector_all 셀렉터 문법 레퍼런스. 타입, testID, 텍스트, 속성, 계층, 기능 셀렉터 및 워크플로우 예시.',
  content: `# query_selector / query_selector_all

React Native Fiber 트리에서 요소를 검색하는 셀렉터 문법. CSS \`querySelector\`와 유사하지만 DOM이 아닌 **React Fiber 트리** 전용.

## 기본 문법

### 타입 셀렉터

컴포넌트 타입 이름으로 검색:

\`\`\`
View
Text
ScrollView
Pressable
FlatList
TextInput
\`\`\`

### testID 셀렉터

\`#\`으로 testID 검색:

\`\`\`
#login-btn
#email-input
#product-list
\`\`\`

타입과 결합 가능:

\`\`\`
Pressable#login-btn
TextInput#email-input
\`\`\`

### 텍스트 셀렉터

\`:text("...")\` — 서브트리 텍스트에서 **부분 문자열 매칭**:

\`\`\`
:text("로그인")
:text("Submit")
Text:text("환영합니다")
Pressable:text("확인")
\`\`\`

> 부모 요소의 모든 자식 텍스트를 합쳐서 검색합니다.
> 예: \`<View><Text>Hello</Text><Text>World</Text></View>\` → \`:text("Hello World")\`로 매칭.

### 속성 셀렉터

\`[attr="value"]\` — props 값으로 검색:

\`\`\`
[accessibilityLabel="닫기"]
[placeholder="이메일 입력"]
View[accessibilityRole="button"]
\`\`\`

### displayName 셀렉터

\`:display-name("...")\` — \`fiber.type.displayName\`으로 매칭 (타입 이름과 무관):

\`\`\`
:display-name("Animated.View")   # Reanimated: 컴포넌트 이름은 AnimatedComponent, displayName으로 Animated.View 매칭
View:display-name("CustomBox")
\`\`\`

### 인덱스 셀렉터

\`:first\` — 첫 번째 매칭 (\`:nth(0)\`와 동일). \`:last\` — 마지막 매칭:

\`\`\`
Pressable:first      # 첫 번째 Pressable
Pressable:last       # 마지막 Pressable
View:text("Bottom sheet"):last   # "Bottom sheet" 포함 View 중 마지막 (예: 하단 시트 패널)
\`\`\`

\`:nth(N)\` — N번째 매칭 (0-based):

\`\`\`
Text:nth(0)          # 첫 번째 Text (= :first)
Pressable:nth(2)     # 세 번째 Pressable
:text("항목"):nth(1) # "항목" 텍스트가 포함된 두 번째 요소
\`\`\`

### 기능 셀렉터

\`:has-press\` — \`onPress\` 핸들러가 있는 요소:

\`\`\`
:has-press                    # 모든 클릭 가능 요소
View:has-press                # onPress가 있는 View
:has-press:text("삭제")       # "삭제" 텍스트를 가진 클릭 가능 요소
\`\`\`

\`:has-scroll\` — \`scrollTo\` 또는 \`scrollToOffset\`이 있는 요소:

\`\`\`
:has-scroll                   # 모든 스크롤 가능 요소
ScrollView:has-scroll         # 스크롤 가능한 ScrollView
\`\`\`

## 계층 셀렉터

### 직접 자식 (\`>\`)

\`\`\`
View > Text              # View의 직접 자식인 Text
ScrollView > View > Text # 3단계 계층
\`\`\`

### 후손 (공백)

\`\`\`
View Text                # View 하위 어디든 있는 Text
ScrollView Pressable     # ScrollView 하위의 모든 Pressable
\`\`\`

### 결합 예시

\`\`\`
View > ScrollView:has-scroll > Pressable:text("추가")
\`\`\`

## OR (콤마)

콤마로 여러 셀렉터를 결합:

\`\`\`
ScrollView, FlatList           # ScrollView 또는 FlatList
Pressable, TouchableOpacity    # 두 타입 모두 검색
#btn-a, #btn-b                 # 두 testID 중 하나
\`\`\`

## 복합 예시

\`\`\`
# 로그인 버튼 찾기
Pressable:text("로그인")

# testID로 TextInput 찾기
TextInput#email-input

# 접근성 라벨로 닫기 버튼 찾기
[accessibilityLabel="닫기"]:has-press

# ScrollView 안의 세 번째 클릭 가능 요소
ScrollView :has-press:nth(2)

# FlatList 또는 ScrollView 찾기
FlatList, ScrollView

# 특정 View 안의 모든 텍스트
View#header > Text
\`\`\`

## 반환값

### query_selector (단일)

\`\`\`json
{
  "uid": "login-btn",
  "type": "Pressable",
  "testID": "login-btn",
  "text": "로그인",
  "accessibilityLabel": null,
  "hasOnPress": true,
  "hasOnLongPress": false,
  "hasScrollTo": false,
  "measure": {
    "x": 100, "y": 200,
    "width": 150, "height": 44,
    "pageX": 100, "pageY": 200
  }
}
\`\`\`

- \`uid\` — testID가 있으면 testID, 없으면 경로 문자열 (예: \`"0.1.2"\`)
- \`measure\` — 요소의 좌표와 크기 (points). pageX/pageY는 화면 왼쪽 상단 기준 절대 좌표.
- \`measure\`가 null인 경우 \`evaluate_script(measureView(uid))\`로 별도 획득 가능 (드문 경우).

### query_selector_all (복수)

\`\`\`json
[
  { "uid": "item-0", "type": "Pressable", "text": "항목 1", "hasOnPress": true, "measure": { ... } },
  { "uid": "item-1", "type": "Pressable", "text": "항목 2", "hasOnPress": true, "measure": { ... } }
]
\`\`\`

## 워크플로우

### 요소 찾기 → 네이티브 탭 (2단계)

\`\`\`
1. query_selector('Pressable:text("로그인")') → uid + measure 획득
2. tap(platform, measure.pageX + measure.width/2, measure.pageY + measure.height/2) → 중앙 탭
\`\`\`

> measure가 결과에 포함되므로 별도 measureView 호출이 불필요합니다.

### 텍스트 검증

\`\`\`
1. assert_text("환영합니다") → { pass: true }
\`\`\`

### 클릭 가능 요소 목록

\`\`\`
query_selector_all(':has-press')
\`\`\`

### 모든 텍스트 노드

\`\`\`
query_selector_all('Text')
\`\`\`

## 문법 요약

| 문법 | 설명 | 예시 |
|---|---|---|
| \`Type\` | 컴포넌트 타입 | \`View\`, \`Text\`, \`Pressable\` |
| \`#id\` | testID | \`#login-btn\` |
| \`[attr="val"]\` | props 속성 | \`[accessibilityLabel="닫기"]\` |
| \`:text("...")\` | 텍스트 부분 매칭 | \`:text("로그인")\` |
| \`:display-name("...")\` | fiber.type.displayName 매칭 | \`:display-name("Animated.View")\` |
| \`:first\` | 첫 번째 매칭 | \`Pressable:first\` |
| \`:last\` | 마지막 매칭 | \`View:text("Bottom sheet"):last\` |
| \`:nth(N)\` | N번째 매칭 (0-based) | \`:nth(0)\` |
| \`:has-press\` | onPress 존재 | \`:has-press\` |
| \`:has-scroll\` | scrollTo 존재 | \`:has-scroll\` |
| \`A > B\` | 직접 자식 | \`View > Text\` |
| \`A B\` | 후손 | \`View Text\` |
| \`A, B\` | OR | \`ScrollView, FlatList\` |
`,
};
