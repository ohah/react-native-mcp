---
name: tool-get-debugger-status
description: MCP get_debugger_status 호출 또는 콘솔/네트워크 이벤트용 CDP 연결 여부 확인 시 사용.
---

# get_debugger_status

## 동작

- **metro-cdp** 싱글톤 조회: Metro CDP 타겟에 붙은 WebSocket 연결 여부와 최근 이벤트 수신 여부(예: 최근 60초). **connected**, **lastEventTimestamp**, **eventCount** 반환. 앱 eval 없음.
- **connected: true**이면 콘솔/네트워크 도구가 이벤트를 받을 수 있음. false면 앱-MCP 연결, Metro 실행, 동일 타겟에 다른 디버거 미연결 확인.
