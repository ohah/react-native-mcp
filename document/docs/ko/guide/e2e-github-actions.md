# GitHub Actions에서 E2E 실행

React Native MCP 기반 E2E 테스트를 **GitHub Actions**에서 자동으로 실행하는 방법입니다.  
저장소에 이미 있는 iOS/Android E2E 워크플로를 참고하면 됩니다.

## 필요한 것

- **MCP 서버 빌드**: CI에서 `bun run build`로 서버 빌드
- **앱 빌드**: iOS는 Xcode/시뮬레이터, Android는 에뮬레이터 또는 실제 기기
- **테스트 실행**: `bun test e2e/...` (스모크 테스트) 또는 YAML 시나리오 러너

## E2E CLI (`react-native-mcp-test`)

- **사용법**: `npx react-native-mcp-test run <path> [options]`
- **CI 권장(빌드 산출물 실행)**: `node packages/react-native-mcp-test/dist/cli.js run <path> [options]`
- **자주 쓰는 옵션**
  - `-p, --platform <ios|android>`: 플랫폼 덮어쓰기
  - `-o, --output <dir>`: 결과 디렉터리
  - `--no-auto-launch`: 설치만 하고 시나리오의 `setup`에서 `launch`로 실행할 때 사용
- 전체 옵션/리포터는 [E2E YAML 레퍼런스](../testing/e2e-yaml-reference.md)의 CLI 섹션을 참고하세요.

## iOS E2E (시뮬레이터)

저장소의 `.github/workflows/e2e-ios.yml` 과 같은 흐름입니다.

1. **Runner**: `macos-latest` (iOS 시뮬레이터 사용 가능)
2. **순서**:
   - 체크아웃 → Bun 설치 → 의존성 설치
   - MCP 서버 빌드 (`bun run build`)
   - Ruby/Bundler → CocoaPods 설치 (필요 시)
   - Xcode로 앱 빌드 (Release, iphonesimulator)
   - 시뮬레이터 부팅 → 앱 설치 → 앱 실행
   - 앱·JS 번들 로드 대기 (예: 25초)
   - E2E 실행: `E2E_PLATFORM=ios bun test e2e/smoke.test.ts` (또는 YAML 러너)
3. **실패 시**: 스크린샷·로그를 아티팩트로 업로드하면 디버깅에 유용합니다.

경로 필터(`paths`)로 packages, examples, e2e, 워크플로 파일이 바뀔 때만 돌리도록 하는 것을 권장합니다.

## Android E2E (에뮬레이터)

저장소의 `.github/workflows/e2e-android.yml` 과 같은 흐름입니다.

1. **Runner**: `ubuntu-latest`
2. **순서**:
   - 체크아웃 → Bun 설치 → 의존성 설치
   - MCP 서버 빌드
   - Android SDK·에뮬레이터 설정 (이미지, AVD 생성 등)
   - 앱 빌드 (Release 또는 Debug)
   - 에뮬레이터 부팅 → 앱 설치 → 앱 실행
   - 로드 대기 후 E2E 실행: `E2E_PLATFORM=android bun test e2e/smoke.test.ts` (또는 YAML 러너)
3. **실패 시**: 로그·스크린샷 아티팩트 업로드

Android는 디스크 공간 부족으로 실패할 수 있으므로, 불필요한 패키지 제거 등으로 공간을 확보하는 단계가 들어가는 경우가 많습니다.

## YAML 시나리오를 CI에서 실행할 때

- E2E 워크플로에서 앱을 빌드·실행한 뒤, **같은 job** 안에서 `bun run test:yaml`(또는 해당 패키지의 run 스크립트)로 YAML 시나리오를 실행하면 됩니다.
- YAML의 `config.bundleId`와 실제 빌드한 앱의 bundleId가 일치해야 합니다.
- `setup`의 `launch`로 앱을 띄우거나, 이미 워크플로 단계에서 앱을 실행해 두고 시나리오만 돌리는 방식 중 하나를 선택하면 됩니다.

## 요약

| 항목      | iOS                                         | Android            |
| --------- | ------------------------------------------- | ------------------ |
| Runner    | macos-latest                                | ubuntu-latest      |
| 앱 빌드   | Xcode, 시뮬레이터                           | Gradle, 에뮬레이터 |
| 실행 예시 | `bun test e2e/smoke.test.ts` 또는 YAML 러너 | 동일               |
| 경로 필터 | packages, examples, e2e, 워크플로           | 동일               |

실제 워크플로 내용은 저장소의 `.github/workflows/e2e-ios.yml`, `.github/workflows/e2e-android.yml` 를 참고하면 됩니다.
