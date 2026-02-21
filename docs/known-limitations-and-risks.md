# 알려진 제한사항 및 리스크

이 문서는 React Native MCP를 채택·도입하기 전에 제한사항과 리스크를 한곳에서 파악하기 위한
요약이다. 상세한 기술 배경은 각 항목에서 링크한 문서를 참고한다.

---

## 제한사항 요약

| 제한                  | 설명                                                     | 우회·권장                                                                                                           |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **iOS 실기기**        | idb/simctl 터치 주입 미지원                              | XCTest/WDA 또는 MCP `type_text` 사용. 상세: [idb-setup.md](idb-setup.md).                                           |
| **Android 실기기**    | localhost가 호스트가 아니면 12300 접속 불가(런타임 한계) | 에뮬레이터 사용 또는 포워딩 설정. [troubleshooting-app-connected-false.md](troubleshooting-app-connected-false.md). |
| **한글 입력 (idb)**   | `idb ui text "한글"` 시 앱 크래시 가능                   | MCP `type_text` 사용. [idb-setup.md](idb-setup.md).                                                                 |
| **멀티터치**          | idb/adb 단일 터치만 지원                                 | 핀치/회전 불가. [DESIGN.md](DESIGN.md) §13.7.                                                                       |
| **Expo Go**           | localhost WebSocket 연결 제한 가능                       | Expo Dev Client 권장. [expo-guide.md](expo-guide.md).                                                               |
| **프로덕션**          | 기본은 MCP 런타임 비활성화                               | 의도적으로 켤 때만 `REACT_NATIVE_MCP_ENABLED=true` 등 env 설정, 보안 검토 후 사용.                                  |
| **FlatList 미렌더링** | 가상화로 미렌더링 아이템은 스냅샷에 없음                 | `scroll_until_visible` 후 조회. [DESIGN.md](DESIGN.md) §8.2.                                                        |
| **WebView**           | idb describe-all은 WebView 내부 미표시                   | `webview_evaluate_script` 우선. [DESIGN.md](DESIGN.md) §13.6.                                                       |
| **iPad HID**          | Return(40)이 멀티태스킹 트리거 가능                      | 앱별 확인. [idb-setup.md](idb-setup.md), [DESIGN.md](DESIGN.md) §13.7.                                              |

---

## 리스크 (보안·운영)

- **보안**: MCP 런타임은 localhost만 허용하는 전제로 동작한다. 프로덕션에서는 기본 비활성화를
  권장하며, MCP를 켤 경우 포트·네트워크 노출을 검토해야 한다.
- **운영**: Health check(GET /health) 및 단순 메트릭(GET /metrics)은 제공한다. 상세:
  [observability.md](observability.md). 요청 수·지연 등 추가 메트릭은 별도 로드맵.
