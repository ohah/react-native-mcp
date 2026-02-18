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
  orientation?: number # iOS GraphicsOrientation 강제값 (1-4, 선택)
setup?: Step[] # 본 단계 전에 실행 (선택)
steps: Step[] # 본 테스트 단계 (필수, 1개 이상)
teardown?: Step[] # 종료 시 실행 (선택)
```

- `config.platform`: `ios` | `android`. CLI `-p` 옵션으로 덮을 수 있음.
- `config.bundleId`: iOS는 `org.example.app`, Android는 `com.example.app` 형태. 지정 시 러너가 서버 기동 후 앱을 자동 실행한다.
- `config.orientation`: iOS 전용. GraphicsOrientation 값(1=Portrait, 2=Portrait180, 3=LandscapeA, 4=LandscapeB)을 강제 지정. 생략 시 `xcrun simctl spawn`으로 자동 감지.
- `setup` / `teardown`: 각각 `Step[]`. 실패 시에도 `teardown`은 실행된다.

---

## Step 타입

아래 키 중 **정확히 하나**만 사용한다. `selector`는 MCP 셀렉터 문법(예: `#testID`, `Text:text("라벨")`)을 따른다.

### tap

요소를 한 번 탭한다.

- **iOS**: 4가지 orientation 모두 지원 (Portrait, Portrait180, LandscapeA, LandscapeB). `xcrun simctl spawn`으로 자동 감지하거나 `config.orientation`으로 강제 지정. ([issue/e2e-landscape-tap-analysis.md](issue/e2e-landscape-tap-analysis.md) 참고)
- **Android**: orientation 보정 없이 동작. 실측에서 정상 동작 확인.

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

| 필드      | 타입             | 필수 | 설명                                                                                      |
| --------- | ---------------- | ---- | ----------------------------------------------------------------------------------------- |
| selector  | string           | ✓    | 대상 요소 셀렉터                                                                          |
| direction | string           | ✓    | `up` \| `down` \| `left` \| `right`                                                       |
| distance  | number \| string |      | 스와이프 거리. 숫자면 dp, `'50%'`처럼 문자열이면 요소 크기 대비 비율. 생략 시 기본값 사용 |

```yaml
- swipe:
    selector: '#list'
    direction: up
    distance: 200 # 절대값 200dp
- swipe:
    selector: '#carousel'
    direction: left
    distance: '80%' # 요소 너비의 80%
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

### back

뒤로가기 버튼을 누른다. `pressButton: { button: BACK }` 의 단축 스텝.

파라미터 없음.

```yaml
- back:
```

---

### home

홈 버튼을 누른다. `pressButton: { button: HOME }` 의 단축 스텝.

파라미터 없음.

```yaml
- home:
```

---

### hideKeyboard

키보드를 닫는다. iOS에서는 Escape 키(HID 41), Android에서는 BACK 키를 보낸다.

파라미터 없음.

```yaml
- hideKeyboard:
```

---

### longPress

요소를 길게 누른다. `tap` + `duration` 래핑으로, YAML 가독성을 위한 별도 스텝.

| 필드     | 타입   | 필수 | 설명                      |
| -------- | ------ | ---- | ------------------------- |
| selector | string | ✓    | 길게 누를 요소 셀렉터     |
| duration | number |      | 누르는 시간(ms). 기본 800 |

```yaml
- longPress:
    selector: '#item-3'
    duration: 1000
```

---

### addMedia

디바이스 갤러리에 미디어 파일(이미지, 동영상)을 추가한다.

| 필드  | 타입     | 필수 | 설명                                  |
| ----- | -------- | ---- | ------------------------------------- |
| paths | string[] | ✓    | 추가할 로컬 파일 경로 배열 (1개 이상) |

```yaml
- addMedia:
    paths: ['/tmp/photo.jpg', '/tmp/video.mp4']
```

---

### assertHasText

텍스트가 (선택 시 해당 요소에) 있는지 검증한다. `assertText`의 별칭(alias).

| 필드     | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| text     | string | ✓    | 기대하는 텍스트  |
| selector | string |      | 검사 범위 셀렉터 |

```yaml
- assertHasText:
    text: '₩12,000'
    selector: '#price-label'
```

---

### clearText

TextInput의 텍스트를 전부 지운다.

| 필드     | 타입   | 필수 | 설명                  |
| -------- | ------ | ---- | --------------------- |
| selector | string | ✓    | 대상 TextInput 셀렉터 |

```yaml
- clearText:
    selector: '#email'
```

---

### doubleTap

요소를 빠르게 두 번 탭한다.

| 필드     | 타입   | 필수 | 설명                         |
| -------- | ------ | ---- | ---------------------------- |
| selector | string | ✓    | 탭할 요소 셀렉터             |
| interval | number |      | 두 탭 사이 간격(ms). 기본 50 |

```yaml
- doubleTap:
    selector: '#zoomable-image'
    interval: 100
```

---

### assertValue

TextInput 등의 `value` prop이 기대값과 일치하는지 검증한다.

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 검사할 요소 셀렉터 |
| expected | string | ✓    | 기대하는 값        |

```yaml
- assertValue:
    selector: '#quantity-input'
    expected: '3'
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
  # orientation: 3  # iOS landscape 강제 (선택)

setup:
  - launch: org.example.app
  - waitForVisible:
      selector: '#login-screen'
      timeout: 5000

steps:
  - typeText:
      selector: '#email'
      text: test@example.com
  - hideKeyboard:
  - typeText:
      selector: '#password'
      text: secret
  - tap:
      selector: '#login-button'
  - waitForText:
      text: '홈'
      timeout: 5000
  - assertHasText:
      text: '환영합니다'
      selector: '#greeting'
  - longPress:
      selector: '#profile-item'
      duration: 1000
  - screenshot:
      path: ./results/login-success.png
  - back:

teardown:
  - terminate: org.example.app
```

## E2E CLI (`react-native-mcp-test`)

### 사용법

`npx react-native-mcp-test run <path> [options]`

- `<path>`: YAML 파일 또는 디렉터리
  - 디렉터리는 **해당 디렉터리 바로 아래의** `.yml`/`.yaml` 파일만 실행한다(하위 폴더 재귀 실행 없음).

### Commands

- `run <path>`: YAML 테스트 파일 또는 디렉터리 실행

### Options

- `-p, --platform <ios|android>`: YAML의 `config.platform`을 덮어쓴다.
- `-r, --reporter <type>`: 리포터 타입. `console` | `junit` | `json` | `html` | `slack` | `github-pr` (기본값: `console`)
- `-o, --output <dir>`: 결과 출력 디렉터리 (기본값: `./results`)
- `--slack-webhook <url>`: Slack 웹훅 URL (`-r slack` 사용 시. 또는 환경변수 `SLACK_WEBHOOK_URL`)
- `--report-url <url>`: Slack 메시지에 넣을 리포트 링크 (예: CI 아티팩트 URL)
- `-t, --timeout <ms>`: 글로벌 타임아웃(연결 대기 등) 덮어쓰기
- `-d, --device <id>`: 디바이스 ID(idb/adb)
- `--no-bail`: 스위트 실패 후에도 다음 스위트를 계속 실행한다 (기본값: 실패 시 중단)
- `--no-auto-launch`: `create()`에서 앱을 자동 실행하지 않는다. CI에서 **설치만** 해두고 `setup`에서 `launch`(또는 워크플로 단계에서 앱 실행)를 사용하는 경우에 쓴다.
- `-h, --help`: 도움말 출력

### 예시

- 디렉터리 실행: `npx react-native-mcp-test run path/to/e2e/ -p ios`
- 단일 파일 실행: `npx react-native-mcp-test run path/to/suite.yaml -p android`
- 결과 경로 지정: `npx react-native-mcp-test run e2e/ -o e2e-artifacts/yaml-results`
- 실패해도 계속 실행: `npx react-native-mcp-test run e2e/ --no-bail`
- CI(빌드 산출물) 실행: `node packages/react-native-mcp-test/dist/cli.js run examples/demo-app/e2e/ -p ios -o e2e-artifacts/yaml-results --no-auto-launch`
- HTML 리포트: `npx react-native-mcp-test run e2e/ -r html -o results` → `results/report.html` 생성
- Slack 전송: `npx react-native-mcp-test run e2e/ -r slack --slack-webhook $SLACK_WEBHOOK` 또는 `SLACK_WEBHOOK_URL` 설정 후 `-r slack`
- GitHub PR 코멘트: CI에서 `GITHUB_REF`가 PR일 때 `npx react-native-mcp-test run e2e/ -r github-pr -o results`

### 실행 결과 (RunResult)

실행이 끝나면 러너는 `RunResult`를 산출한다. 콘솔 리포터는 마지막에 다음 형태로 요약한다.

- `Results: N passed, N failed (duration)` — 실패가 없을 때
- `Results: N passed, N failed, N skipped (duration)` — 한 스텝 실패 후 뒤 스텝이 건너뛰어졌을 때

**집계 규칙**:

- **passed**: 실제로 성공한 스텝만 (`status === 'passed'`). 한 스텝이 실패하면 이후 스텝은 실행하지 않고 **skipped**로 기록되며, skipped는 passed에 포함되지 않는다.
- **failed**: 실패한 스텝 수.
- **skipped**: 실패 이후 실행되지 않은 스텝 수 (같은 스위트 내).

`-r json` 사용 시 `output` 디렉터리의 `results.json`에 `{ total, passed, failed, skipped, duration, suites }`가 저장된다. CLI 종료 코드는 `failed > 0`이면 1, 아니면 0이다.

### 리포터 종류

| 리포터      | 설명                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `console`   | 터미널에 요약·스텝 결과 출력 (기본값).                                                                                                                                               |
| `junit`     | `output/junit.xml` 생성. CI에서 JUnit 리포트로 사용.                                                                                                                                 |
| `json`      | `output/results.json` 생성.                                                                                                                                                          |
| `html`      | `output/report.html` 생성. 스크린샷 포함 시각적 리포트. 브라우저에서 열어 실패 스텝·스크린샷 확인.                                                                                   |
| `slack`     | Slack Incoming Webhook으로 결과 요약 전송. 실패 시 실패 스텝·에러·스크린샷 경로 포함. `--slack-webhook <url>` 또는 `SLACK_WEBHOOK_URL` 필요. `--report-url`로 리포트 링크 추가 가능. |
| `github-pr` | GitHub Actions 등에서 `GITHUB_REF`가 `refs/pull/<number>/merge`일 때 `gh pr comment`로 PR에 결과 코멘트 작성. PR이 아니거나 `gh` 미설치 시 `output/pr-comment.md`에 본문 저장.       |

### 리포터 확인 방법(테스트)

- **HTML**: `-r html -o results` 실행 후 `results/report.html`을 브라우저로 연다. 스위트·스텝 요약, 실패 시 에러 메시지·스크린샷 이미지가 포함되어 있는지 확인.
- **Slack**: 웹훅 URL을 `--slack-webhook` 또는 `SLACK_WEBHOOK_URL`에 넣고 `-r slack`으로 실행. 해당 채널에 요약 메시지가 도착하는지, 실패 시 실패 스텝·에러·스크린샷 경로가 포함되는지 확인.
- **GitHub PR**: PR 브랜치에서 GitHub Actions 등으로 `-r github-pr -o results` 실행. PR 코멘트에 결과가 붙는지 확인. 로컬이거나 PR이 아니면 `results/pr-comment.md`에 본문이 저장되는지 확인.
