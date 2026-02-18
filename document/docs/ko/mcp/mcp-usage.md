# MCP 사용법

Cursor, Claude Desktop, GitHub Copilot CLI에서 React Native MCP 서버를 연결하고 사용하는 방법입니다.

## 공통 설정

각 클라이언트에서 MCP 서버를 다음처럼 등록합니다.

- **Command**: `npx`
- **Args**: `-y @ohah/react-native-mcp-server`

서버가 실행되면 stdio로 MCP 프로토콜을 주고받고, 앱은 Metro를 통해 WebSocket으로 서버에 연결됩니다.

---

## Cursor

1. **Cursor 설정** → **MCP** 로 이동하거나, 프로젝트 `.cursor/mcp.json` 편집
2. 다음 내용 추가:

```json
{
  "mcpServers": {
    "react-native-mcp": {
      "command": "npx",
      "args": ["-y", "@ohah/react-native-mcp-server"]
    }
  }
}
```

3. Cursor 재시작 또는 MCP 새로고침
4. 앱에서 Metro로 번들 실행 후 시뮬레이터/에뮬레이터에서 앱 실행
5. 채팅에서 MCP 도구(take_snapshot, tap, assert_text 등)를 사용해 앱 제어·검증

---

## Claude Desktop / Claude CLI

### 방법 A: Claude CLI `mcp add` (권장)

[Claude Code](https://code.claude.com/) 또는 Claude CLI를 쓰는 경우, 다음 명령으로 서버를 등록할 수 있습니다.

```bash
claude mcp add --transport stdio react-native-mcp -- npx -y @ohah/react-native-mcp-server
```

등록 후 앱을 실행하고 대화에서 MCP 도구를 사용하면 됩니다. `claude mcp list`로 서버 등록 여부를 확인할 수 있습니다.

### 방법 B: 설정 파일 직접 편집

1. 설정 파일 편집
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. 다음 내용 추가:

```json
{
  "mcpServers": {
    "react-native-mcp": {
      "command": "npx",
      "args": ["-y", "@ohah/react-native-mcp-server"]
    }
  }
}
```

3. Claude Desktop 재시작
4. 앱 실행 후 Claude와 대화하면서 MCP 도구 사용

---

## GitHub Copilot CLI

1. Copilot CLI 실행 후 `/mcp add react-native-mcp` 입력
2. 프롬프트에서:
   - **Command**: `npx`
   - **Args**: `-y @ohah/react-native-mcp-server`
3. 또는 `~/.copilot/mcp-config.json` 에 직접 위와 같은 형식으로 추가
4. Copilot CLI 재시작

---

## 사용 가능한 도구 개요

연결이 되면 대략 다음 종류의 도구를 사용할 수 있습니다.

| 용도            | 도구 예시                                                                              |
| --------------- | -------------------------------------------------------------------------------------- |
| 화면 조회       | `take_snapshot`, `take_screenshot`, `query_selector`                                   |
| 검증            | `assert_text`, `assert_visible`                                                        |
| 조작            | `tap`, `swipe`, `input_text`, `type_text`                                              |
| 실행            | `evaluate_script`, `webview_evaluate_script`                                           |
| 접근성 감사     | `accessibility_audit`                                                                  |
| 디바이스        | `get_debugger_status`, `list_devices`                                                  |
| 딥링크          | `open_deeplink`                                                                        |
| 앱 초기화/위치  | `clear_state` (데이터/권한 초기화), `set_location` (시뮬/에뮬 GPS. Android는 에뮬만)   |
| 네트워크 모킹   | `set_network_mock`, `list_network_mocks`, `remove_network_mock`, `clear_network_mocks` |
| 디버깅          | `list_console_messages`, `list_network_requests`                                       |
| 상태 인스펙션   | `inspect_state`, `get_state_changes`, `clear_state_changes`                            |
| 렌더 프로파일링 | `start_render_profile`, `get_render_report`, `clear_render_profile`                    |

AI에게 "지금 앱 화면 스냅샷 찍어줘", "로그인 버튼 눌러줘"처럼 요청하면 해당 도구를 호출해 동작합니다.

---

## MCP 런타임 활성화

앱이 MCP 서버(WebSocket 12300)에 연결되려면 **빌드 시 환경변수**로 활성화합니다. 앱 진입점(`index.js`)에 코드를 넣을 필요 없습니다.

- Metro 실행 시: `REACT_NATIVE_MCP_ENABLED=true` 또는 `REACT_NATIVE_MCP_ENABLED=1`

  ```bash
  REACT_NATIVE_MCP_ENABLED=true npx react-native start
  ```

- 개발 모드(`__DEV__ === true`)에서는 이 환경변수 없이도 자동으로 연결을 시도합니다.

---

## 연결이 안 될 때

- **앱이 연결되지 않음**: Metro가 실행 중인지, 앱에 Babel 프리셋 적용 여부, MCP 활성화용 환경변수(`REACT_NATIVE_MCP_ENABLED=true`)로 Metro를 실행했는지 확인
- **tap/스크린샷이 안 됨**: iOS는 idb, Android는 adb가 설치되어 있고 디바이스가 잡히는지 확인 (`idb list-targets`, `adb devices`)
- **특정 도구만 실패**: 해당 도구의 인자(selector, timeout 등)가 올바른지, 앱 UI가 로드된 상태인지 확인

저장소의 `docs/` 폴더에 트러블슈팅 문서가 있으면 참고하세요.
