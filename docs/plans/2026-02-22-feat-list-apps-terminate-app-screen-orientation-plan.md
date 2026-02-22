---
title: feat - list_apps, terminate_app, get_screen_size, get_orientation, set_orientation
type: feat
status: completed
date: 2026-02-22
deepened: 2026-02-22
---

# list_apps, terminate_app, get_screen_size, get_orientation, set_orientation 구현 계획

## Enhancement Summary

**Deepened on:** 2026-02-22  
**Sections enhanced:** Overview, Proposed Solution, Technical Considerations, Acceptance Criteria, Dependencies & Risks, Implementation Order  
**Research agents used:** best-practices-researcher, framework-docs-researcher, kieran-typescript-reviewer, performance-oracle, security-sentinel, architecture-strategist, agent-native-reviewer

### Key Improvements

1. **terminate_app**: 단일 파라미터 `appId`로 통일 (iOS bundle ID / Android package). description에 "No app connection required", "Use list_apps to discover IDs" 명시.
2. **에러·반환**: 실행 에러는 `isError: true` + actionable 메시지("What went wrong" + "What to do next"). 데이터 도구(list_apps, get_screen_size, get_orientation)는 `[ text 요약, JSON ]`, 액션 도구(terminate_app, set_orientation)는 단일 text.
3. **타임아웃·메모리**: list_apps 15s(env `REACT_NATIVE_MCP_LIST_APPS_TIMEOUT_MS`), get_screen_size iOS 15s, set_orientation 15s. list_apps stdout 상한 2MB 권장. iOS get_screen_size는 스크린샷 시 **파일 경로만** 사용, stdout으로 PNG 수신 금지.
4. **보안**: bundleId/package 검증 `z.string().min(1).max(256).regex(/^[a-zA-Z0-9._-]+$/)`. description에 "For development and CI only. Avoid terminating system or critical apps."
5. **에이전트 친화**: list_apps/terminate_app/get_orientation에 "No app connection required"; get_screen_size에 "iOS: requires app connection; otherwise use Android or connect app"; set_orientation에 "iOS: simulator only", 실기기 에러 시 "Use an iOS simulator or use Android for physical device."

### New Considerations Discovered

- **idb list-apps**: `--json` 사용, NDJSON(한 줄당 JSON) 가능성 있음 → 줄 단위 파싱. 권장 idb 버전 문서 명시.
- **Android set_orientation**: 최신에서는 `wm user-rotation lock 0|1` 사용 가능; 구버전 호환은 `settings put system user_rotation`.
- **get_screen_size**: deviceId별 캐시 권장, set_orientation 성공 시 해당 device 캐시 무효화.
- **set_orientation iOS**: 실기기 여부는 `listIdbTargets()` 후 해당 udid의 `type === 'simulator'`로 판별해 AC에 포함.

---

## Overview

mobile-next/mobile-mcp 호환 및 범용 자동화 스크립트·CI 시나리오를 위해, idb/adb 기반 MCP 도구 5개를 추가한다. 앱 연결 없이 디바이스/앱 제어·화면 정보를 제공한다.

| 도구                | iOS                                                    | Android                          | 비고                                   |
| ------------------- | ------------------------------------------------------ | -------------------------------- | -------------------------------------- |
| **list_apps**       | idb list-apps                                          | adb pm list packages -3          | 앱 연결 불필요                         |
| **terminate_app**   | xcrun simctl terminate / idb terminate                 | adb am force-stop                | 앱 연결 불필요                         |
| **get_screen_size** | 앱 연결 시 getScreenInfo; 없으면 idb describe/스크린샷 | adb wm size                      | 단위: px(density 보정 시 dp 변환 가능) |
| **get_orientation** | simctl spawn defaults read backboardd (1–4)            | settings get user_rotation (0–3) | portrait/landscape + raw 값            |
| **set_orientation** | 시뮬레이터만 (AppleScript 등)                          | settings put user_rotation       | iOS 실기기 = 명시적 에러               |

Relates to #81.

---

## Problem Statement / Motivation

- **list_apps / terminate_app**: CI·멀티앱 시나리오에서 “설치된 앱 확인”, “테스트 전 앱 완전 종료”가 필요하다. 현재는 셸에서 직접 idb/adb를 호출해야 한다.
- **get_screen_size / get_orientation**: 좌표 기반 tap/swipe·스크린샷 해상도 계산·E2E 방향 고정 시 참고용으로 필요하다. `get_debugger_status`에 orientation이 있으나 전용 도구가 없고, 화면 크기는 앱 연결 시에만 간접 사용 가능하다.
- **set_orientation**: E2E에서 portrait/landscape 전환 시나리오를 자동화하려면 필요하다. Android는 adb로 가능하고, iOS는 시뮬레이터만 지원 가능하다.

---

## Proposed Solution

### 1. 공통 패턴 (기존 도구와 동일)

- **파일 위치**: `packages/react-native-mcp-server/src/tools/`
  - `list-apps.ts`, `terminate-app.ts`, `get-screen-size.ts`, `get-orientation.ts`, `set-orientation.ts` (도구당 1파일 또는 2개 그룹으로 묶기)
- **스키마**: `platform: z.enum(['ios','android'])`, 필요 시 `deviceId`(optional), 도구별 인자(bundleId, orientation 등).
- **에러**: idb/adb 미설치 → `idbNotInstalledError()` / `adbNotInstalledError()`. 디바이스 0대/2대+ → `resolveUdid`/`resolveSerial`과 동일한 메시지(“Use list_devices(platform=…)”, “Specify deviceId”).
- **설명**: 도구 `description`과 파라미터 `.describe()`는 **영어** (`.cursor/rules/mcp-tool-descriptions.mdc`), 80~100자 권장.
- **등록**: `tools/index.ts`에서 `registerAllTools` 내에 각 `register*` 호출 추가.

**Research Insights (공통 패턴)**

- **Zod**: `deviceParam`, `platformParam`은 `device-param.ts` 재사용. 도구별 스키마는 `platform` 필수 + `deviceId` optional + 도구별 필드.
- **반환 형식 통일**: 데이터 도구(list_apps, get_screen_size, get_orientation) → `content: [ { type: 'text', text: 요약 }, { type: 'text', text: JSON } ]`. 액션 도구(terminate_app, set_orientation) → 단일 text 블록 (set_location/clear_state와 동일).
- **에러**: idb/adb 미설치·0대·2대+는 기존 resolveUdid/resolveSerial throw 메시지 그대로 노출. `isError: true` + "What went wrong. What to do next" 한 문단으로 작성 (예: "Multiple Android devices. Specify deviceId. Use list_devices(platform=\"android\") to see serials.").
- **파일 레이아웃**: 도구당 1파일 유지 (list-devices, set-location과 동일). get_screen_size + get_orientation 묶지 않음.
- **appSession**: get_screen_size, get_orientation은 `register*(server, appSession)`으로 등록해, "앱 연결 + 해당 디바이스"일 때만 eval(getScreenInfo) 사용; 그 외는 idb/adb. API는 optional 파라미터 없이 하나로 유지.

### 2. list_apps

- **iOS**: `runIdbCommand(['list-apps', '--json'], udid)` (또는 비JSON stdout 파싱). 출력 형식은 로컬 `idb list-apps --json`으로 확인 후 파싱.
- **Android**: `runAdbCommand(['shell', 'pm', 'list', 'packages', '-3'], serial)` → `package:com.example` 형태 파싱.
- **반환**: 텍스트 요약 + JSON 배열. 최소 필드: `bundle_id`(iOS) / `package`(Android), 선택 `name`(표시 이름). 빈 목록은 성공으로 처리.
- **deviceId**: 생략 시 단일 디바이스만 허용(list_devices와 동일).

**Research Insights (list_apps)**

- **iOS**: `idb list-apps --json` 사용. 출력이 NDJSON(한 줄당 JSON)일 수 있으므로 줄 단위 파싱. 로컬에서 한 버전으로 출력 검증 후 문서에 "권장 idb 버전" 명시.
- **Android**: `adb shell pm list packages -3` → `package:com.xxx` 형태. `line.replace(/^package:/, '').trim()` 파싱. `-3`은 서드파티만.
- **stdout 상한**: list_apps 호출에 `maxOutputBytes = 2MB` 권장 (runCommand 확장 또는 도구별 wrapper). 2MB 초과 시 파싱 중단 또는 에러.
- **캐시**: 사용하지 않음(항상 fresh). CI에서 매 스텝 최신 상태 필요.
- **description 제안**: "List installed apps on device/simulator (idb/adb). No app connection required. Returns bundle IDs or packages." 반환 요약에 "Use these IDs with terminate_app(platform, appId)." 한 줄 포함 시 에이전트 체이닝 용이.

### 3. terminate_app

- **iOS**: `runCommand('xcrun', ['simctl', 'terminate', udid, bundleId])` 또는 `runIdbCommand(['terminate', bundleId], udid)`. 프로젝트가 simctl을 쓰면 simctl 우선.
- **Android**: `runAdbCommand(['shell', 'am', 'force-stop', package], serial)`.
- **파라미터**: `platform`, **`appId`** 단일 필드 (iOS bundle ID / Android package). describe: "iOS bundle ID or Android package name (e.g. com.example.app). Use list*apps to find IDs." `deviceId` optional. **입력 검증**: `appId`에 `z.string().min(1).max(256).regex(/^[a-zA-Z0-9.*-]+$/)` 적용.
- **존재하지 않는 앱**: OS가 에러를 주면 그대로 반환; 성공이면 “App terminated.” (이미 종료된 경우도 성공으로 처리 가능).

**Research Insights (terminate_app):** description에 "No app connection required", "Use list_apps to discover IDs" 포함. 보안: "For development and CI only. Avoid terminating system or critical apps."

### 4. get_screen_size

- **Android**: `runAdbCommand(['shell', 'wm', 'size'], serial)` → `Physical size: WxH` 파싱. 단위는 물리 픽셀(px). 필요 시 `wm density`로 scale 보정해 dp 노출 옵션.
- **iOS 앱 연결 있음**: 기존 `eval(getScreenInfo())`로 `window`/`screen` (dp) 반환. “pixels” 요구 시 scale 적용해 px로 변환 가능.
- **iOS 앱 연결 없음**: `idb describe --json`에 해상도 필드가 있으면 사용; 없으면 `idb screenshot -`로 PNG 크기에서 추정하거나, “iOS without app: not supported”로 명시적 에러.
- **반환**: `{ width, height }` + 선택 `unit: 'px' | 'dp'` 등. 다른 도구(tap, screenshot)와 단위 정합성 유지.

**Research Insights (get_screen_size)**

- **Android 파싱**: `Physical size: WxH` 정규식 `match(/Physical size:\s*(\d+)x(\d+)/)`. Override size 별도 줄은 무시.
- **iOS 앱 없음**: idb describe에 해상도 필드 없으면 "get_screen_size on iOS without app connection is not supported" 명시적 에러. 스크린샷 사용 시 **반드시 파일 경로**만 사용하고 stdout으로 PNG 수신 금지(메모리 위험).
- **타임아웃**: Android 10s, iOS 경로 15s (env `REACT_NATIVE_MCP_GET_SCREEN_SIZE_TIMEOUT_MS` 선택, CI 예시 20000).
- **캐시**: deviceId별 캐시 권장; set_orientation 성공 시 해당 device 캐시 무효화.
- **description 제안**: "Return screen size (width/height in px or dp). Android: host-only. iOS: requires app connection for reliable result; otherwise use Android or connect app."

### 5. get_orientation

- **Android**: `runAdbCommand(['shell', 'settings', 'get', 'system', 'user_rotation'], serial)` → 0,1,2,3.
- **iOS**: `execFile('xcrun', ['simctl', 'spawn', udid, 'defaults', 'read', 'com.apple.backboardd'])` → GraphicsOrientation 1–4. plist 파일 직접 읽지 말 것(e2e-orientation-and-idb-coordinates.md).
- **앱 연결 시 (선택)**: get_debugger_status와 동일하게 eval로 `getScreenInfo().orientation` (portrait|landscape) 사용 가능.
- **반환**: 공통 표현 `portrait` | `landscape` + 선택 `raw` (iOS 1–4, Android 0–3). 매핑 테이블은 docs에 명시 (ios-landscape.ts GraphicsOrientation 1–4, Android user_rotation 0–3).

**Research Insights (get_orientation)**

- **Android**: `adb shell settings get system user_rotation` (get/set 모두 `system` 네임스페이스).
- **반환 타입**: `interface OrientationResult { orientation: 'portrait' | 'landscape'; raw?: number }`.
- **description 제안**: "Get current orientation (portrait/landscape). Works without app connection. Returns human-readable and raw platform value."

### 6. set_orientation

- **Android**: `adb shell settings put system accelerometer_rotation 0` 후 `user_rotation 0`(portrait) 또는 `1`(landscape). 2,3(180°, 270°)는 1차 범위에서 제외해도 됨.
- **iOS**: 시뮬레이터만 지원. AppleScript로 Simulator 메뉴 “Device → Rotate Left/Right” 호출 또는 동일 수단. **실기기**에서 호출 시 `isError: true` + “set_orientation on iOS is supported only on simulator” 메시지 반환.
- **파라미터**: `orientation: 'portrait' | 'landscape'`.
- **iOS 실기기**: `listIdbTargets()` 후 해당 udid의 `type === 'simulator'`인지 확인; 아니면 `isError: true` + "set_orientation on iOS is supported only on simulator. Use an iOS simulator or use Android for physical device."

**Research Insights (set_orientation)**

- **Android**: `accelerometer_rotation 0` 후 `user_rotation 0`(portrait) 또는 `1`(landscape). 최신에서는 `wm user-rotation lock 0|1` 사용 가능.
- **타임아웃**: 15s (AppleScript/UI 반영 지연 대비). CI에서 실패 시 해당 스텝만 15–20s + 1회 재시도 고려.
- **description 제안**: "Set orientation to portrait or landscape. Android: device/emulator. iOS: simulator only; fails on physical device."

---

## Technical Considerations

- **타임아웃**: 기존 `runIdbCommand`/`runAdbCommand` 기본 10s 유지. CI에서는 `REACT_NATIVE_MCP_*_TIMEOUT_MS` 등 필요 시 확장.
- **idb 좌표**: get_orientation/get_screen_size는 tap/swipe 좌표 변환과 별개이지만, orientation 값(1–4, 0–3)은 기존 `ios-landscape.ts` 매핑과 일치시켜 두는 것이 좋다.
- **단위**: get_screen_size는 “pixels”를 물리 픽셀(px)로 통일하고, iOS 앱 연결 시에는 scale로 보정한 px 또는 별도 필드로 dp를 줄 수 있다.

---

## Acceptance Criteria

- [x] **list_apps**: `platform`(필수), `deviceId`(선택). iOS에서 idb list-apps 실행 후 파싱해 앱 목록 반환; Android에서 pm list packages -3 파싱. idb/adb 미설치·0대·2대+ 시 기존 도구와 동일한 에러 메시지.
- [x] **terminate_app**: `platform`, **`appId`**(단일 필드, iOS bundle ID / Android package), `deviceId`(선택). appId 검증: `min(1).max(256).regex(/^[a-zA-Z0-9._-]+$/)`. iOS simctl terminate 또는 idb terminate; Android am force-stop. 존재하지 않는 앱은 OS 에러 시 그대로 반환.
- [x] **get_screen_size**: `platform`, `deviceId`(선택). Android wm size 파싱; iOS는 앱 연결 시 getScreenInfo, 없으면 idb describe/스크린샷 또는 “not supported without app” 에러. 반환에 width, height, 단위 명시.
- [x] **get_orientation**: `platform`, `deviceId`(선택). Android user_rotation; iOS backboardd GraphicsOrientation. 반환에 portrait/landscape 및 raw 값(선택).
- [x] **set_orientation**: `platform`, `orientation`(portrait|landscape), `deviceId`(선택). Android user_rotation 0/1 설정; iOS는 udid의 target type이 'simulator'일 때만 지원, 실기기 시 isError + "Use an iOS simulator or use Android for physical device."
- [x] 모든 도구 description·파라미터 설명은 영어(80~100자 권장). list_apps/terminate_app/get_orientation에 "No app connection required" 등 제약 명시. `tools/index.ts`에 등록되어 MCP tools/list에 노출됨.
- [x] 모든 도구: catch에서 `{ isError: true, content: [{ type: 'text', text: '<tool_name> failed: ${message}' }] }` 형식 통일.
- [ ] (선택) list_apps idb 출력 파싱 실패 시 빈 배열 또는 isError 처리 규칙 문서화; 권장 idb 버전 명시.
- [ ] (선택) `list_apps`·`terminate_app`·`get_screen_size`·`get_orientation`·`set_orientation`에 대한 단위 테스트 추가(모의 idb/adb).

---

## Success Metrics

- CI 또는 로컬에서 “list_apps → 앱 목록 확인 → terminate_app → get_screen_size / get_orientation” 흐름이 도구만으로 수행 가능.
- mobile-mcp 사용자가 문서를 보고 유사한 도구 이름·파라미터로 전환 시 예측 가능한 동작.

---

## Dependencies & Risks

- **idb 버전**: `idb list-apps --json` 출력 형식이 버전별로 다를 수 있음. 한 버전에서 파싱 검증 후 문서에 권장 버전 명시. NDJSON(한 줄당 JSON) 가능성 있음 → 줄 단위 파싱.
- **iOS set_orientation**: AppleScript는 Simulator UI에 의존하므로 헤드리스/CI에서 실패할 수 있음. “simulator only, optional”로 문서화. 실기기에서 호출 시 명시적 에러로 fallback 유도.
- **get_screen_size iOS without app**: idb describe에 해상도 필드 있으면 사용; 없으면 “not supported without app” 에러로 고정. 스크린샷 기반은 파일 경로만 사용, stdout PNG 금지.
- **보안**: spawn + 배열 인자 유지(셸 인젝션 없음). bundleId/package 정규식+길이 검증 적용. “For development and CI only” description 권장.

---

## Implementation Order

1. **list_apps** (에러 케이스 단순, 앱 불필요)
2. **terminate_app**
3. **get_orientation** (Android → iOS)
4. **set_orientation** (Android → iOS 시뮬만)
5. **get_screen_size** (Android → iOS 앱 연결 → iOS without app 정책 확정 후)

---

## References & Research

- 기존 패턴: `packages/react-native-mcp-server/src/tools/list-devices.ts`, `set-location.ts`, `clear-state.ts`, `open-deeplink.ts`
- idb/adb 유틸: `idb-utils.ts` (resolveUdid, runIdbCommand), `adb-utils.ts` (resolveSerial, runAdbCommand, getAndroidScale)
- 문서: `docs/IDB_REFERENCE.md` (§3.2, §3.3), `docs/ADB_REFERENCE.md` (§4.2, §4.3, §7.4, §8.4), `docs/e2e-orientation-and-idb-coordinates.md`
- 이슈: #81 (지원 예정 정리)
