# E2E YAML 레퍼런스

`react-native-mcp-test` 러너가 읽는 YAML 시나리오 문법 레퍼런스. 한 파일에 하나의 테스트 스위트를 정의한다.

## 파일 구조

```yaml
name: string # 스위트 이름 (필수)
config: # 설정 (필수)
  platform: ios | android
  timeout?: number # ms, 연결 대기 등
  bundleId?: string # 앱 번들/패키지 ID
  deviceId?: string # idb/adb 디바이스 ID (선택)
setup?: Step[] # 본 단계 전에 실행 (선택)
steps: Step[] # 본 테스트 단계 (필수, 1개 이상)
teardown?: Step[] # 종료 시 실행 (선택)
```

- `config.platform`: `ios` | `android`. CLI `-p` 옵션으로 덮을 수 있음.
- `config.bundleId`: iOS는 `org.example.app`, Android는 `com.example.app` 형태. 지정 시 러너가 서버 기동 후 앱을 자동 실행한다.
- `setup` / `teardown`: 각각 `Step[]`. 실패 시에도 `teardown`은 실행된다.

---

## Step 타입 (API)

아래 키 중 **정확히 하나**만 사용한다. `selector`는 MCP 셀렉터 문법(예: `#testID`, `Text:text("라벨")`)을 따른다.

### tap

요소를 한 번 탭한다.

| 필드     | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| selector | string | ✓    | 탭할 요소 셀렉터 |

```yaml
- tap:
    selector: '#submit-button'
```

---

### swipe

요소 위에서 스와이프한다.

| 필드      | 타입   | 필수 | 설명                                   |
| --------- | ------ | ---- | -------------------------------------- |
| selector  | string | ✓    | 대상 요소 셀렉터                       |
| direction | string | ✓    | `up` \| `down` \| `left` \| `right`    |
| distance  | number |      | 스와이프 거리(px). 생략 시 기본값 사용 |

```yaml
- swipe:
    selector: '#list'
    direction: up
    distance: 200
```

---

### typeText

요소에 텍스트를 입력한다(기존 내용 대체).

| 필드     | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| selector | string | ✓    | 입력 대상 셀렉터 |
| text     | string | ✓    | 입력할 문자열    |

```yaml
- typeText:
    selector: '#email'
    text: user@example.com
```

---

### inputText

현재 포커스된 필드에 텍스트를 입력한다.

| 필드 | 타입   | 필수 | 설명          |
| ---- | ------ | ---- | ------------- |
| text | string | ✓    | 입력할 문자열 |

```yaml
- inputText:
    text: Hello
```

---

### pressButton

하드웨어/소프트 버튼을 누른다.

| 필드   | 타입   | 필수 | 설명                            |
| ------ | ------ | ---- | ------------------------------- |
| button | string | ✓    | 버튼 식별자(예: `home`, `back`) |

```yaml
- pressButton:
    button: back
```

---

### waitForText

지정한 텍스트가 나타날 때까지 대기한다.

| 필드     | 타입   | 필수 | 설명                          |
| -------- | ------ | ---- | ----------------------------- |
| text     | string | ✓    | 기대하는 텍스트               |
| timeout  | number |      | 대기 시간(ms). 생략 시 기본값 |
| selector | string |      | 텍스트를 찾을 범위 셀렉터     |

```yaml
- waitForText:
    text: 'Count: 1'
    timeout: 3000
    selector: '#counter'
```

---

### waitForVisible

요소가 보일 때까지 대기한다.

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 대기할 요소 셀렉터 |
| timeout  | number |      | 대기 시간(ms)      |

```yaml
- waitForVisible:
    selector: '#loaded-view'
    timeout: 5000
```

---

### waitForNotVisible

요소가 사라질 때까지 대기한다.

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 사라질 요소 셀렉터 |
| timeout  | number |      | 대기 시간(ms)      |

```yaml
- waitForNotVisible:
    selector: '#spinner'
    timeout: 3000
```

---

### assertText

텍스트가 (선택 시 해당 요소에) 있는지 검증한다. 실패 시 스텝 실패.

| 필드     | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| text     | string | ✓    | 기대하는 텍스트  |
| selector | string |      | 검사 범위 셀렉터 |

```yaml
- assertText:
    text: '저장됨'
    selector: '#status'
```

---

### assertVisible

요소가 보이는지 검증한다.

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 검사할 요소 셀렉터 |

```yaml
- assertVisible:
    selector: '#main-form'
```

---

### assertNotVisible

요소가 보이지 않는지 검증한다.

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 검사할 요소 셀렉터 |

```yaml
- assertNotVisible:
    selector: '#error-banner'
```

---

### assertCount

셀렉터에 매칭되는 요소 개수가 기대값인지 검증한다.

| 필드     | 타입   | 필수 | 설명                  |
| -------- | ------ | ---- | --------------------- |
| selector | string | ✓    | 개수를 셀 요소 셀렉터 |
| count    | number | ✓    | 기대 개수             |

```yaml
- assertCount:
    selector: ':has-press'
    count: 5
```

---

### screenshot

스크린샷을 저장한다.

| 필드 | 타입   | 필수 | 설명                              |
| ---- | ------ | ---- | --------------------------------- |
| path | string |      | 저장 경로. 생략 시 기본 경로 사용 |

```yaml
- screenshot:
    path: './results/step1.png'
```

---

### wait

고정 시간(ms) 대기한다.

| 필드 | 타입   | 필수 | 설명                                    |
| ---- | ------ | ---- | --------------------------------------- |
| (값) | number | ✓    | 대기 시간(ms). 이 스텝만 숫자 하나로 씀 |

```yaml
- wait: 500
```

---

### launch

앱을 실행한다. 보통 `setup`에서 사용.

| 필드 | 타입   | 필수 | 설명                                       |
| ---- | ------ | ---- | ------------------------------------------ |
| (값) | string | ✓    | 번들/패키지 ID. 이 스텝만 문자열 하나로 씀 |

```yaml
- launch: org.reactnativemcp.demo
```

---

### terminate

앱을 종료한다. 보통 `teardown`에서 사용.

| 필드 | 타입   | 필수 | 설명           |
| ---- | ------ | ---- | -------------- |
| (값) | string | ✓    | 번들/패키지 ID |

```yaml
- terminate: org.reactnativemcp.demo
```

---

### openDeepLink

딥 링크를 연다.

| 필드 | 타입   | 필수 | 설명        |
| ---- | ------ | ---- | ----------- |
| url  | string | ✓    | 딥 링크 URL |

```yaml
- openDeepLink:
    url: myapp://screen/settings
```

---

### evaluate

앱 컨텍스트에서 JavaScript를 실행한다.

| 필드   | 타입   | 필수 | 설명           |
| ------ | ------ | ---- | -------------- |
| script | string | ✓    | 실행할 JS 코드 |

```yaml
- evaluate:
    script: 'global.__testFlag = true;'
```

---

### scrollUntilVisible

스크롤하여 요소가 보일 때까지 반복한다.

| 필드       | 타입   | 필수 | 설명                                |
| ---------- | ------ | ---- | ----------------------------------- |
| selector   | string | ✓    | 보이게 할 요소 셀렉터               |
| direction  | string |      | `up` \| `down` \| `left` \| `right` |
| maxScrolls | number |      | 최대 스크롤 횟수. 초과 시 실패      |

```yaml
- scrollUntilVisible:
    selector: '#footer'
    direction: down
    maxScrolls: 10
```

---

## 전체 예시

```yaml
name: 로그인 플로우
config:
  platform: ios
  timeout: 10000
  bundleId: org.example.app

setup:
  - launch: org.example.app
  - waitForVisible:
      selector: '#login-screen'
      timeout: 5000

steps:
  - typeText:
      selector: '#email'
      text: test@example.com
  - typeText:
      selector: '#password'
      text: secret
  - tap:
      selector: '#login-button'
  - waitForText:
      text: '홈'
      timeout: 5000
  - screenshot:
      path: ./results/login-success.png

teardown:
  - terminate: org.example.app
```

## 실행

- 디렉터리: `npx react-native-mcp-test run path/to/e2e/ -p ios`
- 단일 파일: `npx react-native-mcp-test run path/to/suite.yaml -p android`
- `-p`를 주면 해당 플랫폼의 스위트만 실행된다.
