---
title: E2E 화면 비디오 녹화 기능 추가
type: feat
status: active
date: 2026-02-21
---

# E2E 화면 비디오 녹화 기능 추가

## Enhancement Summary

**Deepened on:** 2026-02-21  
**Sections enhanced:** Overview, Proposed Solution, Technical Considerations, Acceptance Criteria, Implementation Notes, References  
**Research agents used:** architecture-strategist, code-simplicity-reviewer, security-sentinel, web search (Node spawn, idb, adb screenrecord)

### Key Improvements

1. **프로세스 저장 위치**: 녹화 프로세스 참조를 **AppSession**에 두고, 서버 종료 시 `AppSession.stop()`에서 일괄 SIGINT/SIGTERM 정리. (모듈 레벨 Map 대신)
2. **v1 범위 단순화**: 서버당 **최대 1개 녹화**만 허용(`activeRecording` 단일 상태). `record_video(duration)`·YAML startRecording/stopRecording은 **v2로 연기**. deviceId/udid/serial → **deviceId?** 하나로 통일.
3. **보안**: `filePath` 및 Android pull 대상 경로를 **허용 베이스 디렉터리**(e2e-artifacts 또는 outputDir) 하위로 제한해 path traversal 방지.
4. **Node spawn 패턴**: 녹화는 `runCommand` 사용 금지(완료 대기 전제). `child_process.spawn` 직접 사용, stop 시 `child.kill('SIGINT')` 후 `close` 대기; 필요 시 일정 시간 후 SIGKILL.
5. **idb**: "Video file is written to disk only upon exit of the idb process" — 정상 종료(SIGINT/SIGTERM) 필수. CLI 서브커맨드는 `idb video`(IDB_REFERENCE) 또는 `idb record-video`(fbidb.io) 버전 차이 있음 → 구현 시 설치된 idb로 확인.

### New Considerations Discovered

- Android CI 패턴: 일부 파이프라인은 디바이스에서 `screenrecord ... &` 후 `killall -INT screenrecord`, `adb pull` 사용. 우리는 spawn(adb shell screenrecord ...) 후 spawn에 SIGINT 보내는 방식으로 통일해도 됨.
- 유휴 타임아웃은 v1에서 미구현; "서버 exit 시 정리"만 필수로 두면 됨.

---

## Overview

idb(iOS)와 adb(Android)는 이미 화면 녹화 명령을 제공한다. 이를 MCP 도구로 래핑하고, 선택적으로 E2E YAML 스텝으로 노출하여 테스트 실행 구간을 비디오로 남길 수 있게 한다. e2e-comparison에서 현재 비디오 녹화는 ✗로 되어 있으며, Detox/Maestro는 각각 artifacts·startRecording을 지원한다.

## Problem Statement / Motivation

- **현재**: E2E 실패 시 스크린샷·로그만 수집 가능. 실행 흐름을 영상으로 남기려면 사용자가 idb/adb를 직접 호출해야 함.
- **목표**: MCP 클라이언트 또는 E2E 러너가 "녹화 시작 → 스텝 실행 → 녹화 중지"를 한 번에 제어하고, 결과 mp4를 아티팩트로 저장할 수 있게 한다.
- **가치**: CI 실패 디버깅, 회귀 테스트 증거 보존, 데모 영상 생성.

## Proposed Solution

### 1. MCP 도구 (start / stop)

- **start_video_recording**
  - 파라미터: `platform` (ios | android), `filePath` (호스트 절대 경로 또는 스펙으로 정의한 규칙), 선택 `deviceId`/`udid`/`serial`.
  - 동작: iOS는 `idb video <filePath>`, Android는 `adb shell screenrecord` 등. **spawn**으로 자식 프로세스를 띄우고, 프로세스 참조를 세션/플랫폼(또는 deviceId) 스코프로 저장.
  - 반환: "Recording started. Use stop_video_recording to stop." 등 안내 텍스트.

- **stop_video_recording**
  - 파라미터: `platform`, (동일 스코프 식별용) `deviceId` 등.
  - 동작: 저장된 프로세스에 SIGINT 전송, `close` 대기 후 최종 filePath 반환. Android는 디바이스 경로로 녹화했다면 pull 후 호스트 경로 반환.
  - 반환: `{ success: true, filePath: string }` 또는 실패 시 `{ success: false, error: string }`.

**정책 (구현 전 확정 권장)**

- **filePath**: iOS는 idb가 호스트 경로. Android는 디바이스 경로 녹화 후 stop 시 `adb pull`로 호스트 경로에 저장해 반환(호출자는 항상 호스트 경로 기대).
- **start 중복**: 같은 플랫폼/deviceId에서 이미 녹화 중이면 **거부** ("already recording").
- **stop 미호출**: (선택) 유휴 타임아웃 또는 서버 exit 시 자식 프로세스 SIGTERM/SIGINT로 정리.

### 2. 대안: 고정 길이 record_video (선택)

- **record_video**(platform, filePath, durationSeconds)
  - Android: `adb shell screenrecord --time-limit <N> <path>` → runCommand로 처리 가능.
  - iOS: spawn + 타이머 후 SIGINT. 최대 duration 상한(예: 600초) 문서화.

### 3. E2E YAML 스텝 (선택)

- **startRecording**: `{ path?: string }` — path 생략 시 러너 outputDir 기준 기본 파일명.
- **stopRecording**: `{}` — 현재 스코프 녹화 중지.
- setup에서 startRecording, teardown에서 stopRecording 권장. teardown에서 "녹화 중이면 stop" 보장.

### Research Insights (Proposed Solution)

- **v1 권장 범위**: 아키텍처·단순성 리뷰 반영 시 **v1은 start/stop MCP 도구만** 구현. record_video(duration)·YAML 스텝은 v2로 연기 시 parser/runner/types/app-client 변경 제거, 테스트·유지보수 부담 감소.
- **프로세스 저장**: "디바이스당 1개" Map 대신 **서버당 1개** `activeRecording: { platform, process, filePath, deviceId? } | null`만 두면 v1 요구사항(AC1·AC2 단일 디바이스) 충족. 다중 디바이스 동시 녹화는 추후 확장 시 Map으로 전환.
- **파라미터**: start/stop 모두 **deviceId?** 하나만 노출. 문서에 "iOS: udid, Android: serial; 생략 시 플랫폼별 기본 1대" 명시. 내부는 idb-utils/adb-utils의 resolveUdid/resolveSerial 재사용.

## Technical Considerations

- **장시간 프로세스**: `runCommand`는 완료 대기만 지원. **spawn** 후 참조 보관 → stop 시 SIGINT 새 패턴 필요. `video-recording.ts`에서 `child_process.spawn` 직접 사용.
- **타임아웃 분리**: tap용 timeoutMs로 녹화 프로세스 kill 금지. 녹화 전용 타임아웃만 적용.
- **Android**: 스트림 수신 시 `adb exec-out` 사용(PTY 바이너리 깨짐 방지).
- **아티팩트**: 출력 경로 `e2e-artifacts/` 또는 `e2e-artifacts/video/`. CI upload-artifact에 포함 또는 별도 retention.

### Research Insights (Technical Considerations)

- **spawn 사용**: `runCommand`는 "완료 대기" 전제이므로 녹화에 사용하지 않음. `video-recording.ts`에서 `child_process.spawn`만 사용한다고 플랜/주석에 명시해 runCommand timeout과 혼동 방지.
- **Graceful shutdown**: `child.kill('SIGINT')`(또는 `SIGTERM`) 후 `child.on('close', ...)` 대기. 일정 시간 내 종료되지 않으면 `child.kill('SIGKILL')`로 강제 종료(파일 미완성 가능성 문서화).
- **AppSession 정리**: 서버 종료 시 `AppSession.stop()`에서 `activeRecording`이 있으면 해당 프로세스에 SIGTERM/SIGINT 전송. 좀비 녹화 프로세스 방지를 위해 **필수**로 명시.
- **Path 제한(보안)**: `filePath`와 Android pull 대상 호스트 경로는 `path.resolve` 후 **허용 베이스**(e2e-artifacts 또는 runner outputDir) 하위인지 검사. `resolvedPath.startsWith(allowedBase)` 실패 시 거부. Path traversal 방지.

## Acceptance Criteria

- [x] **AC1** iOS: idb·booted 시뮬 1대·filePath=호스트 절대경로일 때 start → stop 후 해당 경로에 재생 가능한 mp4 생성.
- [x] **AC2** Android: adb·기기 1대일 때 start → stop 후 호스트 경로에 재생 가능한 mp4 생성(pull 포함).
- [x] **AC3** idb/adb가 PATH에 없으면 start 실패, 메시지에 "idb"/"adb" 및 미설치 안내.
- [x] **AC4** 해당 플랫폼에 디바이스 0대면 start 실패.
- [x] **AC5** 이미 해당 스코프에서 녹화 중일 때 start 재호출 시 실패 ("already recording").
- [x] **AC6** start 없이 stop 호출 시 "no active recording"으로 안전 반환.
- [x] **AC7** (v2) YAML startRecording/stopRecording 시 test run으로 start → steps → stop 실행, 출력 디렉터리에 mp4 생성.
- [x] **AC8** (v2) 스텝 실패 시 teardown의 stopRecording 실행으로 녹화 프로세스 종료.
- [x] **AC9** (보안) filePath 또는 pull 대상 경로가 허용 베이스(e2e-artifacts/outputDir) 하위가 아니면 start 또는 stop 실패.
- [x] **AC10** (라이프사이클) 서버 종료 시 활성 녹화가 있으면 해당 프로세스에 SIGTERM/SIGINT 전송되어 정리됨.

## Success Metrics

- e2e-comparison.md "비디오 녹화" 항목 ✓로 변경 가능.
- CI 실패 시 아티팩트에 비디오 포함 가능.

## Dependencies & Risks

- **의존성**: idb(macOS·iOS), adb(Android). 기존 도구와 동일.
- **리스크**: stop 미호출 시 좀비 프로세스. 유휴 타임아웃·서버 exit 시 정리로 완화.

## Implementation Notes (파일·순서)

| 작업             | 파일/위치                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| MCP 도구 구현    | **신규** `packages/react-native-mcp-server/src/tools/video-recording.ts` — spawn, 프로세스 맵, start/stop 핸들러.      |
| 도구 등록        | `packages/react-native-mcp-server/src/tools/index.ts` — import 및 registerAllTools 내 호출.                            |
| idb/adb          | `idb-utils.ts` resolveUdid, `adb-utils.ts` resolveSerial 활용. Android는 디바이스 임시 경로 → stop 시 pull 반환.       |
| YAML 스텝 (선택) | `parser.ts` stepSchema → `runner.ts` executeStep → `types.ts` TestStep → `app-client.ts` startRecording/stopRecording. |
| 문서             | `document/docs/en/testing/e2e-yaml-reference.md`(및 ko) Video 스텝. `docs/e2e-comparison.md` 비디오 녹화 ✓.            |

### Research Insights (Implementation Notes)

- **v1 구현 범위**: video-recording.ts에서 **start_video_recording** / **stop_video_recording**만 구현. `activeRecording`은 AppSession에 단일 슬롯으로 보관. record_video·YAML 스텝은 v2에서 추가.
- **허용 경로**: `filePath` 검증 시 `path.resolve(filePath)` 후 `startsWith(allowedBase)` 사용. allowedBase는 기본값 `process.cwd() + '/e2e-artifacts'` 또는 runner의 outputDir; 설정 가능하게 할지 결정.

## References

- `docs/IDB_REFERENCE.md` §2.2·2.3 (idb video), `docs/ADB_REFERENCE.md` §3.2 (screenrecord).
- `packages/react-native-mcp-server/src/tools/take-screenshot.ts` (platform 분기), `run-command.ts` (spawn 미사용 → video-recording에서 직접 spawn).
- Node.js: [Child process](https://nodejs.org/docs/latest/api/child_process.html), [SIGINT to child](https://stackoverflow.com/questions/44788013/node-child-processes-how-to-intercept-signals-like-sigint).
- idb: [Video | idb](https://fbidb.io/docs/video) — 서브커맨드가 `record-video`로 문서화된 버전 있음; 구현 시 로컬 `idb --help`로 확인.
- Android CI: Bitrise 등은 `adb shell screenrecord ... &` 후 `killall -INT screenrecord`, `adb pull` 패턴 사용. 우리는 spawn(adb shell screenrecord) + spawn에 SIGINT로 통일 가능.
