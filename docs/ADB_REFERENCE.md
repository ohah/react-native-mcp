# adb (Android Debug Bridge) 명령어 레퍼런스

Android SDK에 포함된 디바이스/에뮬레이터 자동화 도구.
React Native MCP에서는 네이티브 제스처 주입(스와이프, 드래그 등)에 활용한다.

> 공식 문서: https://developer.android.com/tools/adb

---

## 공통 옵션

| 옵션          | 설명                                      |
| ------------- | ----------------------------------------- |
| `-s <serial>` | 특정 디바이스 지정 (`adb devices`로 확인) |
| `-d`          | USB 연결 디바이스만                       |
| `-e`          | 에뮬레이터만                              |

---

## 1. UI 인터랙션 (`adb shell input`)

### 1.1 탭

```bash
adb shell input tap <x> <y>
```

### 1.2 스와이프

```bash
adb shell input swipe <x1> <y1> <x2> <y2> [duration_ms]
```

- `duration`: **밀리초** (idb는 초 단위)
- 예: `adb shell input swipe 300 800 300 200 500` (500ms)

### 1.3 롱프레스

```bash
# 같은 좌표로 스와이프 + 긴 duration
adb shell input swipe <x> <y> <x> <y> 1000
```

- 전용 명령 없음. swipe 시작=끝 동일 + 긴 duration으로 구현

### 1.4 텍스트 입력

```bash
adb shell input text "<문자열>"
```

- **영문/숫자/기호만** 지원. 공백은 `%s`, 특수문자는 이스케이프 필요
- 한글 등 유니코드: `adb shell am broadcast` + 클립보드 방식 필요 (아래 참조)

**한글 입력 우회:**

```bash
# ADBKeyBoard 앱 설치 후 (https://github.com/nickelghost/adb-keyboard)
adb shell am broadcast -a ADB_INPUT_TEXT --es msg "한글 텍스트"

# 또는 클립보드 방식
adb shell input keyevent 279  # PASTE (일부 기기만)
```

### 1.5 키 입력

```bash
# 단일 키
adb shell input keyevent <KEYCODE>

# 롱프레스 키
adb shell input keyevent --longpress <KEYCODE>
```

주요 키코드:

| 키코드 | 키                  | 키코드 | 키               |
| ------ | ------------------- | ------ | ---------------- |
| 3      | HOME                | 4      | BACK             |
| 24     | VOLUME_UP           | 25     | VOLUME_DOWN      |
| 26     | POWER               | 27     | CAMERA           |
| 61     | TAB                 | 62     | SPACE            |
| 66     | ENTER               | 67     | DEL (Backspace)  |
| 82     | MENU                | 84     | SEARCH           |
| 111    | ESCAPE              | 112    | DELETE (Forward) |
| 122    | HOME (커서)         | 123    | END (커서)       |
| 187    | APP_SWITCH (최근앱) | 224    | BRIGHTNESS_DOWN  |
| 231    | VOICE_ASSIST        |        |                  |

전체 목록: https://developer.android.com/reference/android/view/KeyEvent

### 1.6 드래그 앤 드롭

```bash
adb shell input draganddrop <x1> <y1> <x2> <y2> [duration_ms]
```

- API 24+ (Android 7.0)
- swipe와 다르게 드래그 이벤트로 인식됨

### 1.7 롤 (스크롤 휠)

```bash
adb shell input roll <dx> <dy>
```

- 마우스 휠 스크롤 시뮬레이션

### 1.8 모션 이벤트 (저수준)

```bash
adb shell input motionevent <DOWN|UP|MOVE|CANCEL> <x> <y>
```

- 개별 터치 이벤트를 순차적으로 보낼 수 있음
- **멀티터치도 가능** (idb와 다른 점!)

```bash
# 핀치 줌 시뮬레이션 (sendevent 활용)
adb shell sendevent /dev/input/event1 3 57 0   # 터치0 시작
adb shell sendevent /dev/input/event1 3 53 300  # 터치0 x
adb shell sendevent /dev/input/event1 3 54 500  # 터치0 y
adb shell sendevent /dev/input/event1 3 57 1   # 터치1 시작
adb shell sendevent /dev/input/event1 3 53 500  # 터치1 x
adb shell sendevent /dev/input/event1 3 54 500  # 터치1 y
adb shell sendevent /dev/input/event1 0 0 0    # sync
```

---

## 2. 접근성 / UI 트리 (`uiautomator`)

### 2.1 UI 트리 덤프

```bash
# XML로 덤프
adb shell uiautomator dump /sdcard/ui.xml
adb pull /sdcard/ui.xml .

# stdout으로 직접 출력 (일부 기기)
adb shell uiautomator dump /dev/tty
```

- idb `describe-all`의 Android 버전
- XML 형식으로 모든 접근성 요소 포함
- `resource-id`, `text`, `content-desc`, `bounds`, `class` 등 포함

**출력 예시:**

```xml
<node index="0" text="Submit" resource-id="com.myapp:id/submit_btn"
      class="android.widget.Button" content-desc="Submit button"
      bounds="[100,200][300,260]" clickable="true" />
```

### 2.2 접근성 서비스 상태

```bash
adb shell settings get secure enabled_accessibility_services
```

---

## 3. 스크린 캡처 / 녹화

### 3.1 스크린샷

```bash
# 디바이스에 저장 후 pull
adb shell screencap /sdcard/screen.png
adb pull /sdcard/screen.png .

# stdout으로 직접 (더 빠름)
adb exec-out screencap -p > screen.png
```

### 3.2 화면 녹화

```bash
adb shell screenrecord /sdcard/recording.mp4
# Ctrl+C로 종료 (또는 --time-limit)
adb pull /sdcard/recording.mp4 .
```

| 옵션                | 설명                                  |
| ------------------- | ------------------------------------- |
| `--time-limit <초>` | 최대 녹화 시간 (기본 180초, 최대 180) |
| `--size <W>x<H>`    | 해상도                                |
| `--bit-rate <bps>`  | 비트레이트 (기본 20Mbps)              |
| `--bugreport`       | 프레임에 타임스탬프 오버레이          |

---

## 4. 앱 관리

### 4.1 설치 / 삭제

```bash
# 설치
adb install <path.apk>
adb install -r <path.apk>   # 재설치 (데이터 유지)
adb install -t <path.apk>   # 테스트 APK 허용

# 삭제
adb uninstall <package_name>
adb uninstall -k <package_name>  # 데이터 유지하고 삭제
```

### 4.2 실행 / 종료

```bash
# 실행 (메인 액티비티)
adb shell am start -n <package>/<activity>
# 예:
adb shell am start -n com.myapp/.MainActivity

# 인텐트로 실행
adb shell am start -a android.intent.action.VIEW -d "myapp://product/123"

# 종료
adb shell am force-stop <package_name>

# 모든 백그라운드 프로세스 종료
adb shell am kill <package_name>
```

### 4.3 앱 정보

```bash
# 설치된 패키지 목록
adb shell pm list packages
adb shell pm list packages -3      # 서드파티만
adb shell pm list packages | grep myapp

# 패키지 상세 정보
adb shell dumpsys package <package_name>

# 현재 foreground 액티비티
adb shell dumpsys activity activities | grep mResumedActivity
```

### 4.4 딥링크 / URL

```bash
adb shell am start -a android.intent.action.VIEW -d "<url>"
# 예:
adb shell am start -a android.intent.action.VIEW -d "https://example.com"
adb shell am start -a android.intent.action.VIEW -d "myapp://home"
```

---

## 5. 파일 시스템

```bash
# 로컬 → 디바이스
adb push <local> <remote>

# 디바이스 → 로컬
adb pull <remote> <local>

# 디렉토리 목록
adb shell ls <path>

# 파일 읽기
adb shell cat <path>

# 파일 삭제
adb shell rm <path>

# 앱 데이터 디렉토리 (run-as로 접근, debug 빌드만)
adb shell run-as <package_name> ls /data/data/<package_name>/
adb shell run-as <package_name> cat /data/data/<package_name>/shared_prefs/prefs.xml
```

**앱 데이터 추출 (debug 빌드):**

```bash
# AsyncStorage (SQLite)
adb shell run-as com.myapp cat databases/RKStorage > RKStorage.db

# SharedPreferences
adb shell run-as com.myapp cat shared_prefs/com.myapp_preferences.xml
```

---

## 6. 로그

### 6.1 logcat

```bash
# 전체 로그 스트리밍
adb logcat

# 특정 태그 필터
adb logcat ReactNative:V ReactNativeJS:V *:S

# React Native console.log만
adb logcat -s ReactNativeJS

# 레벨 필터 (V=Verbose, D=Debug, I=Info, W=Warn, E=Error)
adb logcat *:E          # 에러만
adb logcat *:W          # 경고 이상

# 버퍼 지우기
adb logcat -c

# 최근 N줄
adb logcat -t 100

# JSON 형식 (API 31+)
adb logcat --format json
```

**idb와의 차이: `adb logcat -s ReactNativeJS`로 RN console.log를 직접 필터 가능!**

### 6.2 크래시 / ANR

```bash
# ANR traces
adb pull /data/anr/traces.txt .

# 크래시 (tombstone)
adb shell ls /data/tombstones/
adb pull /data/tombstones/ .

# bugreport (전체 디버그 정보)
adb bugreport <output_dir>
```

---

## 7. 디바이스 설정

### 7.1 시스템 설정

```bash
# 읽기
adb shell settings get <namespace> <key>
# namespace: system, secure, global

# 쓰기
adb shell settings put <namespace> <key> <value>
```

```bash
# 예시
adb shell settings put system screen_brightness 200
adb shell settings put global airplane_mode_on 1
adb shell settings put secure location_mode 3  # 위치 켜기
```

### 7.2 권한

```bash
# 권한 부여
adb shell pm grant <package> <permission>
# 예:
adb shell pm grant com.myapp android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.myapp android.permission.CAMERA

# 권한 취소
adb shell pm revoke <package> <permission>

# 앱 권한 목록
adb shell dumpsys package <package> | grep permission
```

### 7.3 네트워크

```bash
# Wi-Fi ON/OFF
adb shell svc wifi enable
adb shell svc wifi disable

# 모바일 데이터
adb shell svc data enable
adb shell svc data disable

# 현재 네트워크 정보
adb shell dumpsys connectivity
```

### 7.4 기타

```bash
# GPS 위치 설정 (에뮬레이터)
adb emu geo fix <longitude> <latitude>
# 예: 서울 시청
adb emu geo fix 126.9780 37.5665

# 화면 회전
adb shell settings put system accelerometer_rotation 0  # 자동회전 끄기
adb shell settings put system user_rotation 0  # 세로
adb shell settings put system user_rotation 1  # 가로

# 화면 켜기/끄기
adb shell input keyevent 26   # POWER
adb shell input keyevent 82   # MENU (잠금해제)

# 배터리 상태 시뮬레이션 (에뮬레이터)
adb emu power capacity 15
adb emu power status not-charging

# 전화/SMS 시뮬레이션 (에뮬레이터)
adb emu sms send 01012345678 "테스트 문자"
adb emu gsm call 01012345678
```

---

## 8. 디바이스 관리

### 8.1 연결

```bash
# 연결된 디바이스 목록
adb devices -l

# Wi-Fi 디버깅 (Android 11+)
adb pair <ip>:<port>
adb connect <ip>:<port>

# 연결 해제
adb disconnect <ip>:<port>

# adb 서버 재시작
adb kill-server
adb start-server
```

### 8.2 에뮬레이터 관리

```bash
# 사용 가능한 AVD 목록
emulator -list-avds

# 에뮬레이터 시작
emulator -avd <avd_name> [-no-window] [-no-audio]

# 에뮬레이터 종료
adb emu kill
```

### 8.3 디바이스 정보

```bash
# 기본 정보
adb shell getprop ro.product.model       # 모델명
adb shell getprop ro.build.version.sdk   # API 레벨
adb shell getprop ro.build.version.release # Android 버전

# 화면 크기/밀도
adb shell wm size          # 예: Physical size: 1080x2400
adb shell wm density       # 예: Physical density: 420

# 배터리 상태
adb shell dumpsys battery
```

---

## 9. 프로파일링 / 디버깅

```bash
# 힙 덤프
adb shell am dumpheap <pid> /sdcard/heap.hprof
adb pull /sdcard/heap.hprof .

# 프로세스 목록
adb shell ps | grep <package>

# CPU/메모리 정보
adb shell dumpsys meminfo <package>
adb shell dumpsys cpuinfo

# 네트워크 통계
adb shell dumpsys netstats

# GPU 렌더링 프로파일
adb shell dumpsys gfxinfo <package>

# systrace
adb shell atrace --list_categories
python systrace.py -o trace.html sched gfx view

# StrictMode 위반
adb shell setprop log.tag.StrictMode DEBUG
```

---

## 10. 포트 포워딩

```bash
# 디바이스 포트 → 로컬 포트
adb forward tcp:<local_port> tcp:<device_port>
# 예: Metro 번들러
adb forward tcp:8081 tcp:8081

# 로컬 포트 → 디바이스 포트
adb reverse tcp:<device_port> tcp:<local_port>
# 예: MCP WebSocket
adb reverse tcp:12300 tcp:12300

# 포워딩 목록
adb forward --list
adb reverse --list

# 포워딩 제거
adb forward --remove tcp:<port>
adb reverse --remove-all
```

**React Native에서 중요:**

```bash
# MCP 서버 연결을 위한 역방향 포워딩
adb reverse tcp:12300 tcp:12300

# Metro 번들러 연결
adb reverse tcp:8081 tcp:8081
```

---

## 11. idb vs adb 비교

| 기능              | idb (iOS)                     | adb (Android)                                      |
| ----------------- | ----------------------------- | -------------------------------------------------- |
| **탭**            | `idb ui tap x y`              | `adb shell input tap x y`                          |
| **스와이프**      | `idb ui swipe x1 y1 x2 y2 초` | `adb shell input swipe x1 y1 x2 y2 ms`             |
| **롱프레스**      | ❌ (swipe 대안)               | `adb shell input swipe x y x y 1000`               |
| **드래그앤드롭**  | ❌                            | `adb shell input draganddrop`                      |
| **멀티터치**      | ❌                            | ✅ `sendevent` 활용                                |
| **텍스트 입력**   | `idb ui text`                 | `adb shell input text`                             |
| **한글 입력**     | ❌ 크래시                     | ❌ (ADBKeyBoard 우회)                              |
| **키 입력**       | `idb ui key` (HID)            | `adb shell input keyevent` (Android KEYCODE)       |
| **물리 버튼**     | `idb ui button HOME`          | `adb shell input keyevent 3`                       |
| **UI 트리**       | `idb ui describe-all`         | `adb shell uiautomator dump`                       |
| **포인트 쿼리**   | `idb ui describe-point x y`   | ❌                                                 |
| **스크린샷**      | `idb screenshot`              | `adb exec-out screencap -p`                        |
| **화면 녹화**     | `idb video`                   | `adb shell screenrecord`                           |
| **비디오 스트림** | `idb video-stream`            | `adb exec-out screenrecord --output-format=h264 -` |
| **RN 콘솔 로그**  | ❌ (syslog 노이즈)            | ✅ `adb logcat -s ReactNativeJS`                   |
| **앱 파일 접근**  | `idb file`                    | `adb shell run-as` (debug만)                       |
| **포트 포워딩**   | ❌                            | ✅ `adb forward/reverse`                           |
| **GPS 설정**      | `idb set-location`            | `adb emu geo fix`                                  |
| **권한 부여**     | `idb approve` (제한적)        | `adb shell pm grant` (세밀)                        |
| **푸시 알림**     | `idb send-notification`       | `adb shell am broadcast`                           |
| **Wi-Fi 제어**    | ❌                            | `adb shell svc wifi`                               |
| **실기기 지원**   | ❌ 터치 미지원                | ✅ 전체 지원                                       |

### adb의 강점 (idb 대비)

1. **멀티터치**: `sendevent`로 핀치/회전 가능
2. **RN 콘솔 로그**: `logcat -s ReactNativeJS`로 바로 필터
3. **실기기 전체 지원**: USB 연결 시 모든 기능 사용 가능
4. **포트 포워딩**: `adb reverse`로 MCP WebSocket 연결 용이
5. **드래그앤드롭**: 전용 명령어 존재
6. **네트워크 제어**: Wi-Fi, 모바일 데이터 ON/OFF

### idb의 강점 (adb 대비)

1. **포인트 쿼리**: `describe-point`로 WebView 내부도 관통
2. **XCTest 통합**: 네이티브 테스트 실행
3. **Instruments/xctrace**: 프로파일링 도구 연동
4. **시뮬레이터 관리**: create/clone/erase 등

---

## 12. React Native MCP와의 조합 패턴

idb와 동일한 하이브리드 패턴:

```
1. MCP query_selector → 요소 찾기 + 좌표 획득     (~100 토큰)
2. adb shell input tap/swipe → 터치 주입           (~30 토큰)
3. MCP assert_text → 결과 검증                     (~50 토큰)
─────────────────────────────────────────────────
총 ~180 토큰/제스처
```

### Android 전용 보너스

```bash
# MCP와 별도로 RN 콘솔 로그 모니터링
adb logcat -s ReactNativeJS

# 네트워크 상태 변경 후 앱 동작 확인
adb shell svc wifi disable
# → MCP assert_text로 오프라인 UI 확인
adb shell svc wifi enable
```
