# Chrome DevTools MCP 스펙 정렬

React Native MCP 서버는 [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) 및 [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)와 **동일한 도구 이름·파라미터 스펙**을 따른다.
상위 폴더의 **electron-mcp-server** 설계와 동일한 원칙을 적용한다.

---

## 1. 목적

- MCP 클라이언트(Cursor, Claude 등)와 에이전트 스킬을 **Chrome DevTools MCP / Electron MCP 문서와 공유**할 수 있게 한다.
- 도구 이름·인자 이름·타입을 레퍼런스와 맞추어, "list_console_messages", "take_screenshot" 등을 **동일한 방식**으로 호출할 수 있게 한다.

---

## 2. 지원 도구 및 파라미터 (Chrome DevTools MCP 기준)

### 2.1 Debugging

| 도구                    | 지원 | 비고                                                                                                                                |
| ----------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `take_screenshot`       | ✅   | RN: `platform`(android\|ios) 필수. Chrome과 동일하게 `filePath`, `format`, `quality` 옵션 지원.                                     |
| `take_snapshot`         | ✅   | Fiber 컴포넌트 트리(타입/testID/자식) 기반 스냅샷. uid = testID 또는 경로 "0.1.2". maxDepth 옵션. querySelector 대체용.             |
| `evaluate_script`       | ✅   | Chrome과 동일: `function`(string), `args`(array). WebSocket eval로 앱에서 실행.                                                     |
| `list_console_messages` | ✅   | metro-cdp 직접 CDP WebSocket 연결로 수집한 Runtime.consoleAPICalled 등. `pageIdx`, `pageSize`, `types`, `includePreservedMessages`. |
| `get_console_message`   | ✅   | `msgid`로 단건 조회.                                                                                                                |

### 2.2 Network

| 도구                    | 지원 | 비고                                                                                                |
| ----------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| `list_network_requests` | ✅   | CDP 이벤트에서 Network.\* 수집. `pageIdx`, `pageSize`, `resourceTypes`, `includePreservedRequests`. |
| `get_network_request`   | ✅   | `reqid`(requestId)로 단건 조회.                                                                     |

### 2.3 Navigation

| 도구                      | 지원      | 비고                                   |
| ------------------------- | --------- | -------------------------------------- |
| `list_pages`              | ❌ 제거됨 | RN은 단일 앱. 별도 페이지 관리 불필요. |
| `select_page`             | ❌ 제거됨 | 단일 페이지만 있으므로 불필요.         |
| `navigate_page`           | ❌        | RN에는 URL 네비게이션 없음.            |
| `close_page` / `new_page` | ❌        | 해당 없음.                             |

### 2.4 Input automation

| 도구          | 지원      | 비고                                                            |
| ------------- | --------- | --------------------------------------------------------------- |
| `click`       | ❌ 제거됨 | 네이티브 `tap` 도구로 대체 (실제 터치 파이프라인).              |
| `long_press`  | ❌ 제거됨 | 네이티브 `tap(duration)` 도구로 대체.                           |
| key (키 입력) | ✅        | `input_key(platform)` 통합 도구로 네이티브 키 입력.             |
| `fill`        | ✅        | `type_text` 도구로 구현 (onChangeText 직접 호출, Unicode 지원). |
| drag, hover   | 🔲        | 예정. (hover는 RN 터치 환경에서 해당 없을 수 있음)              |

### 2.5 Emulation / Performance

| 도구                     | 지원 | 비고               |
| ------------------------ | ---- | ------------------ |
| `emulate`, `resize_page` | ❌   | RN 환경에 없음.    |
| `performance_*`          | ❌   | 별도 설계 시 고려. |

### 2.6 Accessibility (RN 전용)

| 도구                  | 지원 | 비고                                                                                                                                                                                                              |
| --------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessibility_audit` | ✅   | Fiber 트리 순회로 접근성 규칙 위반 검출. 반환: `[{ rule, selector, severity, message }]`. 규칙: pressable-needs-label, image-needs-alt, touch-target-size, missing-role. `maxDepth`, `deviceId`, `platform` 옵션. |

---

## 3. 공통 규칙

- **includeSnapshot**: 스냅샷 포함 여부. RN에서는 take_snapshot 미구현 시 무시 가능.
- **uid**: Chrome은 a11y 스냅샷의 uid. RN은 **testID** 또는 컴포넌트 스냅샷의 uid로 매핑.
- **pageId**: RN은 단일 앱이므로 `pageId` 개념 없음. `list_pages`는 제거됨.

---

## 4. 데이터 소스

- **콘솔/네트워크**: `list_console_messages`, `list_network_requests` 도구는 현재 미등록(stub).
- **Metro base URL**: 환경 변수 `METRO_BASE_URL` (기본값 `http://localhost:8230`).

---

## 5. 참고

- electron-mcp-server: `docs/MCP-SERVER-DESIGN.md`, `docs/issue-chrome-devtools-mcp-features.md`
- Chrome DevTools MCP: https://github.com/ChromeDevTools/chrome-devtools-mcp
