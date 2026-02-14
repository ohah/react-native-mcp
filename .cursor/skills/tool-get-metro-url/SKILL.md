---
name: tool-get-metro-url
description: MCP get_metro_url 호출 또는 CDP에 사용 중인 Metro URL 확인 시 사용.
---

# get_metro_url

## 동작

- CDP(예: list_console_messages, list_network_requests)에 사용 중인 Metro base URL 반환: 연결된 앱의 init 페이로드에서 가져오거나, 없으면 **METRO_BASE_URL** env, 없으면 `http://localhost:8230`. 앱 eval 없음, 서버만. 파라미터 없음.
