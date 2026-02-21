---
description: react-native-mcp-server test 러너용 YAML 시나리오 문법 레퍼런스. 파일 구조, config, steps, teardown 설명.
---

# E2E YAML 레퍼런스

`@ohah/react-native-mcp-server test` 러너가 읽는 YAML 시나리오 문법 레퍼런스. 한 파일에 하나의 테스트 스위트를 정의한다.

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

러너는 7개 카테고리에 걸쳐 **32가지 스텝 타입**을 지원한다. 각 스텝의 상세 내용은 [스텝 레퍼런스](./steps/overview)를 참고한다.

| 카테고리                                    | 스텝 수 | 설명                                           |
| ------------------------------------------- | ------- | ---------------------------------------------- |
| [인터랙션](./steps/interaction)             | 8       | 탭, 스와이프, 텍스트 입력, 길게 누르기, 스크롤 |
| [검증](./steps/assertions)                  | 5       | 텍스트, 가시성, 요소 개수, 값 검증             |
| [대기](./steps/waits)                       | 4       | 텍스트, 가시성, 고정 시간 대기                 |
| [내비게이션 & 디바이스](./steps/navigation) | 7       | 버튼, 뒤로, 홈, 딥링크, 위치, 초기화           |
| [앱 생명주기](./steps/lifecycle)            | 2       | 앱 실행 및 종료                                |
| [스크린샷](./steps/screenshots)             | 2       | 스크린샷 캡처 및 비교                          |
| [유틸리티](./steps/utilities)               | 4       | 텍스트 복사·붙여넣기, JS 실행, 미디어 추가     |

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
  - assertText:
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

## E2E CLI (`@ohah/react-native-mcp-server test`)

### 사용법

`npx @ohah/react-native-mcp-server test run <path> [options]`

- `<path>`: YAML 파일 또는 디렉터리
  - 디렉터리는 **해당 디렉터리 바로 아래의** `.yml`/`.yaml` 파일만 실행한다(하위 폴더 재귀 실행 없음).

### Commands

- `run <path>`: YAML 테스트 파일 또는 디렉터리 실행

### Options

- `-p, --platform <ios|android>`: YAML의 `config.platform`을 덮어쓴다.
- `-r, --reporter <type>`: 리포터 타입. `console` | `junit` | `json` | `html` | `slack` | `github-pr` (기본값: `console`)
- `-o, --output <dir>`: 결과 출력 디렉터리 (기본값: `./results`)
- `--slack-webhook <url>`: Slack 웹훅 URL (`-r slack` 사용 시. 또는 `SLACK_WEBHOOK_URL`)
- `--report-url <url>`: Slack 메시지용 리포트 링크 (예: CI 아티팩트 URL)
- `-t, --timeout <ms>`: 글로벌 타임아웃(연결 대기 등) 덮어쓰기
- `-d, --device <id>`: 디바이스 ID(idb/adb)
- `--no-bail`: 스위트 실패 후에도 다음 스위트를 계속 실행한다 (기본값: 실패 시 중단)
- `--no-auto-launch`: `create()`에서 앱을 자동 실행하지 않는다. CI에서 **설치만** 해두고 `setup`에서 `launch`(또는 워크플로 단계에서 앱 실행)를 사용하는 경우에 쓴다.
- `-h, --help`: 도움말 출력

### 예시

- 디렉터리 실행: `npx @ohah/react-native-mcp-server test run path/to/e2e/ -p ios`
- 단일 파일 실행: `npx @ohah/react-native-mcp-server test run path/to/suite.yaml -p android`
- 결과 경로 지정: `npx @ohah/react-native-mcp-server test run e2e/ -o e2e-artifacts/yaml-results`
- 실패해도 계속 실행: `npx @ohah/react-native-mcp-server test run e2e/ --no-bail`
- CI(빌드 산출물) 실행: `node packages/react-native-mcp-server/dist/test/cli.js run examples/demo-app/e2e/ -p ios -o e2e-artifacts/yaml-results --no-auto-launch`
- HTML 리포트: `npx @ohah/react-native-mcp-server test run e2e/ -r html -o results`
- Slack: `npx @ohah/react-native-mcp-server test run e2e/ -r slack --slack-webhook $SLACK_WEBHOOK`
- GitHub PR 코멘트: CI에서 `-r github-pr -o results`

### 리포터 종류

| 리포터      | 설명                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| `console`   | 터미널 요약·스텝 출력 (기본값).                                            |
| `junit`     | `output/junit.xml`. CI JUnit 리포트.                                       |
| `json`      | `output/results.json`.                                                     |
| `html`      | `output/report.html`. 스크린샷 포함 시각적 리포트.                         |
| `slack`     | Slack 웹훅으로 결과 전송. `--slack-webhook` 또는 `SLACK_WEBHOOK_URL` 필요. |
| `github-pr` | PR일 때 `gh pr comment`로 코멘트 작성. 아니면 `output/pr-comment.md` 저장. |

### 리포터 확인 방법

- **HTML**: 실행 후 `output/report.html`을 브라우저에서 열어 스위트·스텝·실패 스크린샷 확인.
- **Slack**: `-r slack` 실행 후 해당 채널에 요약 메시지·실패 시 상세 내용 도착 여부 확인.
- **GitHub PR**: PR에서 `-r github-pr` 실행 후 PR 코멘트 또는 `output/pr-comment.md` 본문 확인.
