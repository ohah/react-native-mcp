# idb (iOS Development Bridge) 설치 가이드

React Native MCP에서 **네이티브 제스처 주입**(스와이프, 드래그, 물리 버튼 등)을 사용하려면 idb가 필요합니다.

> idb는 Facebook이 만든 iOS 시뮬레이터/디바이스 자동화 도구입니다.
> 공식 문서: https://fbidb.io/docs/installation/

---

## 설치

idb는 두 개의 컴포넌트로 구성됩니다:

### 1. idb-companion (macOS 네이티브)

시뮬레이터/디바이스와 통신하는 백그라운드 프로세스입니다.

```bash
brew tap facebook/fb
brew install idb-companion
```

### 2. idb client (Python CLI)

idb 명령어를 실행하는 클라이언트입니다. Python 3.6 이상이 필요합니다.

```bash
pip3 install fb-idb
```

또는 [pipx](https://pipx.pypa.io/)를 사용하면 격리된 환경에 설치할 수 있습니다:

```bash
pipx install fb-idb
```

### 3. 설치 확인

```bash
idb list-targets
```

부팅된 시뮬레이터가 있으면 `Booted` 상태로 표시됩니다.

---

## 언제 idb가 필요한가?

### idb가 필수인 경우

| 상황                              | 이유                          |
| --------------------------------- | ----------------------------- |
| RNGH `Gesture.Pan/Pinch/Rotation` | 네이티브 터치 파이프라인 필수 |
| Reanimated worklet 제스처         | JS 스레드 밖에서 실행         |
| 드로워 스와이프 열기/닫기         | 엣지 제스처                   |
| 바텀시트 드래그                   | 연속 터치 이벤트 필요         |
| 페이저 스와이프                   | 네이티브 스크롤 제스처        |

### 네이티브 도구 없이 가능한 경우

| 상황            | MCP 도구                  |
| --------------- | ------------------------- |
| 텍스트 입력     | `type_text`               |
| WebView JS 실행 | `webview_evaluate_script` |

---

## MCP에서 사용할 수 있는 네이티브 도구

설치 후 다음 MCP 도구를 사용할 수 있습니다 (모두 `platform` 파라미터로 iOS/Android 통합):

| 도구           | 설명                                      |
| -------------- | ----------------------------------------- |
| `list_devices` | 연결된 시뮬레이터/디바이스 목록 (ID 확인) |
| `tap`          | 좌표 탭                                   |
| `swipe`        | 스와이프 (시작→끝 좌표 + 시간)            |
| `input_text`   | 텍스트 입력 (ASCII만)                     |
| `input_key`    | 키코드 전송 (iOS: HID, Android: keyevent) |
| `describe_ui`  | 접근성/UI 트리 조회                       |
| `press_button` | 물리 버튼 (HOME, LOCK 등)                 |

### 권장 워크플로우 (MCP + 네이티브 하이브리드)

MCP를 "눈"(요소 탐색, 결과 검증), 네이티브 도구를 "손"(터치 주입)으로 사용합니다:

```
1. MCP query_selector → 요소 찾기 + 좌표 획득
2. tap / swipe → 네이티브 터치 주입
3. MCP assert_text → 결과 검증
```

---

## 트러블슈팅

### "idb: command not found"

`pip3 install fb-idb`로 설치했는지 확인합니다. PATH에 Python bin 디렉토리가 포함되어야 합니다.

```bash
python3 -m site --user-base
# 출력 경로/bin 이 PATH에 있는지 확인
```

### "No companion found"

idb-companion이 설치되어 있는지 확인합니다:

```bash
brew list idb-companion
```

시뮬레이터를 부팅하면 companion이 자동으로 연결됩니다.

### "Multiple booted simulators found"

여러 시뮬레이터가 부팅된 경우 `udid` 파라미터를 지정해야 합니다:

```bash
# UDID 확인
idb list-targets

# MCP 도구에서 udid 지정
tap(platform="ios", x=200, y=400, deviceId="87A53F69-25AA-4F96-8629-C14917CCEC44")
```

### 한글 입력이 안 됨

`idb ui text`는 HID 키코드를 전송하므로 **현재 키보드 언어에 의존**합니다.
한글 키보드 상태에서 `idb ui text "hello"`를 실행하면 한글 자모로 변환되어 입력됩니다.

**우회 방법:**

1. **MCP `type_text` 사용 (권장)**: 키보드를 우회하여 `onChangeText`를 직접 호출합니다. 한글, 이모지 등 모든 유니코드를 지원합니다.

2. **키보드 전환 후 `input_text` 사용**: macOS에서 AppleScript로 시뮬레이터 키보드 언어를 전환할 수 있습니다.

```bash
# macOS에서 iOS 시뮬레이터 키보드 언어 전환 (Ctrl+Space)
osascript -e '
tell application "Simulator" to activate
delay 0.3
tell application "System Events"
    key code 49 using control down
end tell
'
```

> **참고:** AppleScript는 macOS 전용입니다. Windows/Linux에서는 사용할 수 없습니다.
> idb 자체도 iOS 시뮬레이터 전용이므로 macOS에서만 동작합니다.

---

## iOS(idb) vs Android(adb) 비교

| 기능        | iOS 시뮬레이터 (idb)             | Android (adb)                    |
| ----------- | -------------------------------- | -------------------------------- |
| 터치 주입   | `idb ui tap/swipe`               | `adb shell input tap/swipe`      |
| 텍스트 입력 | `idb ui text` (현재 키보드 의존) | `adb shell input text` (ASCII만) |
| 키보드 확인 | 어려움                           | `adb shell ime list -s`          |
| 키보드 전환 | AppleScript (macOS만)            | `adb shell ime set <id>`         |
| 한글 입력   | MCP `type_text` 권장             | MCP `type_text` 권장             |
| 실기기 지원 | ❌ (시뮬레이터만)                | ✅                               |
| 작동 OS     | macOS만                          | macOS, Windows, Linux            |

> React Native 앱이라면 MCP `type_text`가 iOS/Android 모두에서 한글을 포함한 모든 유니코드 입력을 지원합니다.
> `input_text`는 영문(ASCII) 입력에만 사용하세요.

---

## 알려진 제한사항

| 제한          | 설명                                    | 우회                                            |
| ------------- | --------------------------------------- | ----------------------------------------------- |
| iOS 실기기    | 터치 주입 미지원 (시뮬레이터만)         | XCTest/WDA 프레임워크 또는 MCP `type_text` 사용 |
| 멀티터치      | 단일 터치만 지원                        | 핀치/회전 불가                                  |
| 한글 입력     | `idb ui text`는 현재 키보드 언어에 의존 | MCP `type_text` 사용                            |
| 키보드 전환   | `idb`에 내장 전환 명령 없음             | AppleScript `Ctrl+Space` (macOS만)              |
| iPad HID      | Return(40)이 멀티태스킹 트리거 가능     | 앱별 확인 필요                                  |
| Windows/Linux | idb는 macOS 전용                        | Android는 adb로 모든 OS에서 사용 가능           |
