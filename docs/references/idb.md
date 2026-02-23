# idb (iOS Development Bridge) 명령어 레퍼런스

Facebook이 만든 iOS 시뮬레이터/디바이스 자동화 도구.
React Native MCP에서는 네이티브 제스처 주입(스와이프, 드래그 등)에 활용한다.

> 공식 문서: https://www.fbidb.io/docs/guided-tour

---

## 공통 옵션

모든 명령에 적용 가능한 글로벌 옵션:

| 옵션                                        | 설명                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `--udid UDID`                               | 타겟 디바이스 지정 (환경변수 `IDB_UDID`로도 설정 가능) |
| `--json`                                    | JSON 형식 출력                                         |
| `--log {DEBUG,INFO,WARNING,ERROR,CRITICAL}` | 로그 레벨 설정                                         |
| `--companion HOSTNAME:PORT`                 | companion 서버 직접 지정                               |
| `--companion-tls`                           | TLS 암호화 연결                                        |

---

## 1. UI 인터랙션 (`idb ui`)

화면 터치, 키 입력, 접근성 트리 조회 등 UI 자동화 핵심 명령.

### 1.1 탭

```bash
idb ui tap <x> <y>
```

- 지정 좌표를 한 번 탭
- 좌표는 **포인트 단위** (픽셀 아님)

### 1.2 스와이프

```bash
idb ui swipe <x1> <y1> <x2> <y2> <duration>
```

- `(x1, y1)` → `(x2, y2)`로 스와이프
- `duration`: 초 단위 (0.3 = 300ms)
- RNGH `Gesture.Pan`, 드로워, 페이저 등 네이티브 제스처 트리거 가능

**예시:**

```bash
# 드로워 열기 (좌측 엣지 → 우측)
idb ui swipe 15 400 250 400 0.3

# 페이저 넘기기 (우→좌)
idb ui swipe 600 500 200 500 0.3
```

### 1.3 텍스트 입력

```bash
idb ui text "<문자열>"
```

- 현재 포커스된 입력 필드에 텍스트 전송
- **영문/숫자만 안정적**. 한글 등 유니코드 직접 입력 시 크래시 가능
- 한글은 두벌식 키 매핑 사용: `"네이버"` → `"spdlqj"` (소프트 키보드 한글 모드에서)

### 1.4 키 입력

```bash
# 단일 키
idb ui key <keycode>

# 연속 키
idb ui key-sequence <keycode1> <keycode2> ...
```

주요 HID 키코드:

| 키코드 | 키           |
| ------ | ------------ |
| 40     | Return/Enter |
| 42     | Backspace    |
| 43     | Tab          |
| 44     | Space        |
| 41     | Escape       |

**주의:** iPad 시뮬레이터에서 HID 40(Return)이 멀티태스킹을 트리거할 수 있음.

### 1.5 물리 버튼

```bash
idb ui button <BUTTON_NAME> [--duration <초>]
```

| 버튼          | 설명        |
| ------------- | ----------- |
| `HOME`        | 홈 버튼     |
| `LOCK`        | 잠금/전원   |
| `SIDE_BUTTON` | 사이드 버튼 |
| `SIRI`        | Siri 호출   |
| `APPLE_PAY`   | Apple Pay   |

### 1.6 접근성 트리 조회

```bash
# 전체 트리
idb ui describe-all [--nested] [--json]

# 특정 좌표의 요소
idb ui describe-point <x> <y> [--nested] [--json]
```

| 옵션       | 설명                                      |
| ---------- | ----------------------------------------- |
| `--nested` | 계층 구조(트리) 형태로 출력 (기본은 flat) |
| `--json`   | JSON 형식 출력                            |

**차이점:**

- `describe-all`: 전체 화면 요소. WebView 내부는 **미표시**
- `describe-point`: 특정 좌표 요소. WebView 내부도 **관통하여 표시**

---

## 2. 스크린 캡처 / 녹화

### 2.1 스크린샷

```bash
idb screenshot <dest_path>
# stdout으로 출력
idb screenshot -
```

- PNG 형식으로 저장

### 2.2 화면 녹화

```bash
idb video <output.mp4>
# Ctrl+C로 녹화 종료
```

- mp4 파일로 저장
- E2E 테스트 실행 과정을 영상으로 기록할 때 유용

### 2.3 비디오 스트리밍

```bash
idb video-stream [output_file] [--fps N] [--format FORMAT] [--compression-quality 0.0~1.0] [--scale-factor 0.0~1.0]
```

| 옵션                    | 설명                               |
| ----------------------- | ---------------------------------- |
| `--fps N`               | 프레임레이트 (기본: 동적)          |
| `--format`              | `h264`, `rbga`, `mjpeg`, `minicap` |
| `--compression-quality` | 압축 품질 0.0~1.0                  |
| `--scale-factor`        | 해상도 스케일 0.0~1.0              |

- `output_file` 생략 시 stdout으로 출력
- 실시간 모니터링, CI 비디오 아티팩트에 활용

---

## 3. 앱 관리

### 3.1 설치 / 삭제

```bash
# 설치 (.app이 .ipa보다 빠름)
idb install <path_to_.app_or_.ipa> [--make-debuggable]

# 삭제
idb uninstall <bundle_id>
```

### 3.2 실행 / 종료

```bash
# 실행
idb launch <bundle_id> [app_arguments...]
  -w    # 프로세스 종료까지 대기, stdout/stderr 출력
  -d    # 디버거 연결 대기 (suspend 상태로 시작)
  -f    # 이미 실행 중이면 foreground로
  -p <file>  # PID를 파일에 기록

# 종료
idb terminate <bundle_id>
```

### 3.3 앱 목록

```bash
idb list-apps [--fetch-process-state]
```

- `--fetch-process-state`: 각 앱의 실행 상태(Running/Suspended 등)도 표시

### 3.4 URL 열기

```bash
idb open <url>
```

- 딥링크, 유니버설 링크 테스트에 활용
- 예: `idb open "myapp://product/123"`

---

## 4. 시뮬레이터 관리

### 4.1 생명주기

```bash
# 생성
idb create <device_type> <os_version>
# 예: idb create "iPhone 15 Pro" "17.4"

# 부팅
idb boot [udid] [--headless]
# --headless: 창 없이 부팅, idb 프로세스 종료 시 시뮬레이터도 종료

# 종료
idb shutdown

# 초기화 (공장 초기화)
idb erase

# 삭제
idb delete [udid]
idb delete-all

# 복제
idb clone [udid]
```

### 4.2 정보 조회

```bash
# 타겟 상세 정보
idb describe [--diagnostics]

# 연결된 모든 타겟 목록
idb list-targets [--only simulator|device|mac]
```

### 4.3 기타

```bash
# 시뮬레이터 창을 전면으로
idb focus
```

---

## 5. 파일 시스템 (`idb file`)

앱 컨테이너 내부 파일에 직접 접근. AsyncStorage DB, 캐시 파일 등 조작 가능.

```bash
# 로컬 → 디바이스
idb file push <local_path> <remote_path> <bundle_id>

# 디바이스 → 로컬
idb file pull <remote_path> <local_path> <bundle_id>

# 디렉토리 목록
idb file ls <remote_path> <bundle_id>

# 파일 읽기 (stdout 출력)
idb file read <remote_path> <bundle_id>

# stdin → 파일 쓰기
idb file write <remote_path> <bundle_id>

# 디렉토리 생성
idb file mkdir <remote_path> <bundle_id>

# 삭제
idb file rm <remote_path> <bundle_id>

# 이동/이름변경
idb file mv <src> <dst> <bundle_id>
```

**활용 예시:**

```bash
# AsyncStorage SQLite DB 추출
idb file pull RCTAsyncLocalStorage/manifest.sqlite ./manifest.sqlite com.myapp

# 앱 컨테이너 내 파일 목록
idb file ls Documents com.myapp
```

---

## 6. 로그 / 크래시

### 6.1 시스템 로그

```bash
idb log -- [log 옵션들]
```

`--` 뒤에 macOS `log` 명령의 인수를 전달:

```bash
# 전체 로그 스트리밍
idb log

# JSON 형식
idb log -- --style json

# predicate 필터
idb log -- --predicate 'eventMessage contains "React"'
idb log -- --predicate 'processImagePath endswith "MyApp"'
idb log -- --predicate 'eventType == logEvent and messageType == error'

# 레벨 필터
idb log -- --level info
idb log -- --level debug
```

**주의:** 시스템 로그(syslog)이므로 RN `console.log`는 직접 매칭되지 않음. 노이즈가 많아서 predicate 필터 필수.

### 6.2 크래시 로그

```bash
# 크래시 목록
idb crash list

# 특정 크래시 상세
idb crash show <crash_name>

# 크래시 삭제
idb crash delete <crash_name>
```

---

## 7. 디바이스 설정

### 7.1 위치

```bash
idb set-location <latitude> <longitude>
# 예: 서울 시청
idb set-location 37.5665 126.9780
```

### 7.2 권한 승인

```bash
idb approve <bundle_id> <permission> [<permission> ...]
```

| 권한           | 설명                         |
| -------------- | ---------------------------- |
| `photos`       | 사진 라이브러리              |
| `camera`       | 카메라                       |
| `contacts`     | 연락처                       |
| `location`     | 위치                         |
| `notification` | 알림                         |
| `url`          | URL scheme (`--scheme` 필요) |

```bash
# 카메라 + 위치 동시 승인
idb approve com.myapp camera location
```

### 7.3 설정값 (Preferences)

```bash
# 읽기
idb get <name> [--domain <domain>]

# 쓰기
idb set <name> <value> [--domain <domain>] [--type <type>]
# type: string(기본), bool, int, float 등
```

```bash
# 예: 하드웨어 키보드 비활성화
idb set AutomaticMinimizationEnabled --domain com.apple.Preferences --type bool false
```

### 7.4 기타 설정

```bash
# 키체인 초기화
idb clear-keychain

# 메모리 경고 시뮬레이션
idb simulate-memory-warning

# 푸시 알림 전송
idb send-notification <bundle_id> '<json_payload>'
# 예:
idb send-notification com.myapp '{"aps":{"alert":"테스트 알림","badge":1}}'

# 미디어 추가 (사진/영상)
idb add-media /path/to/photo.jpg /path/to/video.mp4

# 연락처 업데이트
idb contacts update <db_path>

# 사용 가능한 로케일
idb list locale
```

---

## 8. 테스트 / 프로파일링

### 8.1 XCTest

```bash
# 테스트 번들 설치
idb xctest install <path_to_xctest>

# 설치된 번들 목록
idb xctest list

# 번들 내 테스트 목록
idb xctest list-bundle <bundle_name>

# 테스트 실행
idb xctest run <test_bundle_id> <app_bundle_id>
```

### 8.2 Instruments / xctrace

```bash
# Instruments 프로파일링
idb instruments --template <template_name> [--app-bundle-id <id>] [--output <path>]
  --operation-duration <초>
  --app-args <args>
  --app-env KEY=VALUE

# xctrace 기록
idb xctrace record --template <template>
```

### 8.3 디버그 서버

```bash
idb debugserver start
idb debugserver stop
idb debugserver status
```

- `--make-debuggable` 옵션으로 설치한 앱에 lldb 연결 가능

### 8.4 DAP (Debug Adapter Protocol)

```bash
idb dap <dap_pkg_path>
```

- VSCode DAP 프로토콜로 디버그 서버 생성

---

## 9. 개발용 바이너리 설치

```bash
# dSYM (심볼 파일)
idb dsym install <path>

# 동적 라이브러리
idb dylib install <path>

# 프레임워크
idb framework install <path>
```

---

## 10. 연결 관리

```bash
# companion 연결
idb connect <host:port>

# 연결 해제
idb disconnect <host:port>

# 인터랙티브 셸
idb shell [--no-prompt]
```

---

## 11. React Native MCP와의 조합 패턴

### 하이브리드 워크플로우 (권장)

MCP를 "눈"(요소 탐색, 결과 검증), idb를 "손"(터치 주입)으로 사용:

```
1. MCP query_selector → 요소 찾기 + 좌표 획득     (~100 토큰)
2. idb ui tap/swipe   → 네이티브 터치 주입         (~30 토큰)
3. MCP assert_text    → 결과 검증                  (~50 토큰)
─────────────────────────────────────────────────
총 ~180 토큰/제스처  (vs idb-only describe-all: ~2,000-4,000 토큰)
```

### idb가 필수인 경우

| 상황                              | 이유                                        |
| --------------------------------- | ------------------------------------------- |
| RNGH `Gesture.Pan/Pinch/Rotation` | 네이티브 터치 파이프라인 필수               |
| Reanimated worklet 제스처         | JS 스레드 밖에서 실행                       |
| 드로워 스와이프 열기/닫기         | 엣지 제스처                                 |
| 바텀시트 드래그                   | 연속 터치 이벤트 필요                       |
| WebView 내부 터치                 | MCP `webview_evaluate_script`로 부족한 경우 |

### MCP만으로 충분한 경우

| 상황             | MCP 도구                             |
| ---------------- | ------------------------------------ |
| 버튼 탭          | `click` / `click_by_label`           |
| 롱프레스         | `long_press` / `long_press_by_label` |
| 스크롤           | `scroll` (scrollTo)                  |
| 텍스트 입력      | `type_text`                          |
| WebView JS 실행  | `webview_evaluate_script`            |
| 텍스트 존재 확인 | `assert_text`                        |
| 요소 존재 확인   | `assert_visible`                     |

---

## 12. 알려진 제한사항

| 제한            | 설명                                    | 우회                                  |
| --------------- | --------------------------------------- | ------------------------------------- |
| 한글 입력       | `idb ui text "한글"` → 크래시           | 두벌식 매핑 + 소프트 키보드 한글 모드 |
| 멀티터치        | 단일 터치만 지원                        | 핀치/회전 불가, 네이티브 모듈 필요    |
| iOS 실기기      | 터치 주입 미지원                        | XCTest 프레임워크 필요                |
| HID 키코드 충돌 | iPad에서 Return(40)이 멀티태스킹 트리거 | 앱별 확인 필요                        |
| WebView 접근성  | `describe-all`은 WebView 내부 미표시    | `describe-point` 사용                 |
| 소프트 키보드   | 하드웨어 키보드 연결 시 미표시          | `Cmd+Shift+K` 토글                    |
