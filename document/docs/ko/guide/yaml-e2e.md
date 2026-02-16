# E2E YAML 시나리오

AI 없이 **YAML 파일**로 시나리오를 정의하고, 로컬이나 GitHub Actions에서 E2E 테스트를 실행할 수 있습니다.

## YAML 시나리오란

`@ohah/react-native-mcp-test` 패키지가 지원하는 형식으로, 한 파일에 **플랫폼**, **설정**, **setup/steps/teardown** 을 적습니다.  
MCP 도구(tap, assertText, waitForText 등)를 시나리오 단계로 실행합니다.

## 기본 구조

```yaml
name: 시나리오 이름
config:
  platform: ios # ios | android
  timeout: 10000 # 단계별 타임아웃(ms)
  bundleId: org.example.app

setup:
  - launch: org.example.app
  - waitForVisible:
      selector: '#main-screen'

steps:
  - assertText:
      text: 'Count: 0'
      selector: '#counter'
  - tap:
      selector: '#increment-btn'
  - waitForText:
      text: 'Count: 1'
      timeout: 3000

teardown:
  - terminate: org.example.app
```

- **config**: 플랫폼, 타임아웃, bundleId
- **setup**: 앱 실행(launch), 특정 요소가 보일 때까지 대기 등
- **steps**: 탭, 텍스트 입력, 텍스트/가시성 검증, 스크린샷 등
- **teardown**: 앱 종료 등 정리

## 자주 쓰는 단계

| 단계             | 용도                                 |
| ---------------- | ------------------------------------ |
| `launch`         | 앱 실행 (bundleId)                   |
| `terminate`      | 앱 종료                              |
| `tap`            | selector에 해당하는 요소 탭          |
| `assertText`     | 특정 텍스트가 selector에 있는지 검증 |
| `waitForText`    | 특정 텍스트가 나올 때까지 대기       |
| `waitForVisible` | selector가 보일 때까지 대기          |
| `screenshot`     | 스크린샷 저장 (path 지정)            |

selector는 보통 앱에서 지정한 **testID** 를 `#testID` 형태로 사용합니다.

## 예시: 버튼 탭 후 카운트 검증

```yaml
name: Press Counter 버튼 탭
config:
  platform: ios
  timeout: 10000
  bundleId: org.reactnativemcp.demo

setup:
  - launch: org.reactnativemcp.demo
  - waitForVisible:
      selector: '#press-counter-button'

steps:
  - assertText:
      text: 'Count: 0'
      selector: '#press-counter-button'
  - tap:
      selector: '#press-counter-button'
  - waitForText:
      text: 'Count: 1'
      timeout: 3000
  - tap:
      selector: '#press-counter-button'
  - assertText:
      text: 'Count: 2'
      selector: '#press-counter-button'
  - screenshot:
      path: './results/counter.png'

teardown:
  - terminate: org.reactnativemcp.demo
```

## 실행 방법

프로젝트에서 YAML 시나리오를 실행하려면:

1. MCP 서버 빌드: `bun run build` (또는 `build:server`)
2. 앱이 이미 실행 중이거나, 시나리오의 `setup`에서 `launch`로 실행되도록 구성
3. 테스트 러너 실행 (저장소 스크립트에 따라 다름). 예:

```bash
bun run test:yaml
```

또는 `@ohah/react-native-mcp-test` 의 `run` 스크립트로 지정한 YAML 파일을 실행합니다.  
자세한 옵션은 패키지 README나 [GitHub Actions에서 E2E 실행](./e2e-github-actions) 문서를 참고하세요.

## GitHub Actions에서 쓰기

YAML 시나리오는 CI에서 그대로 사용할 수 있습니다.  
[GitHub Actions에서 E2E 실행](./e2e-github-actions)에서 워크플로 예시와 주의사항을 안내합니다.
