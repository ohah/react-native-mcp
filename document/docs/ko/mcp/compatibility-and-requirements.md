# 호환성 및 요구사항

React Native MCP를 도입하기 전에 아래 요구사항을 충족하는지 확인하세요. 자동 검증은
[도입 전 체크리스트](adoption-checklist)의 doctor 스크립트를 사용할 수 있다.

---

## 환경별 요구사항

| 항목                 | 요구사항                                                 | 비고                                                                     |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Node**             | ≥ 24                                                     | MCP 서버 실행 환경. `engines.node` 기준.                                 |
| **Bun**              | ≥ 1.0.0 (선택)                                           | Node 대신 사용 시.                                                       |
| **React Native**     | **≥ 0.74** (New Architecture 기준)                       | 0.83.x 검증 완료. [Expo 사용 시](expo-guide)는 해당 가이드 참고.         |
| **New Architecture** | 지원 (최소 0.74)                                         | Fabric 0.83.x에서 검증 완료.                                             |
| **Hermes**           | 사용 가정                                                | React Native 기본 엔진.                                                  |
| **Expo**             | Dev Client ✅ / Expo Go △ / EAS production 시 MCP 비활성 | 상세: [Expo 가이드](expo-guide).                                         |
| **OS (MCP 서버)**    | macOS (idb·iOS), Windows/Linux (Android adb)             | iOS 시뮬레이터 자동화는 macOS + idb 필요.                                |
| **iOS 실기기**       | 터치 주입 미지원                                         | 시뮬레이터 권장. [알려진 제한·리스크](known-limitations-and-risks) 참고. |

---

## 버전 매트릭스 (요약)

| React Native     | Bare / Expo Dev Client | Expo Go     |
| ---------------- | ---------------------- | ----------- |
| 0.74+ (New Arch) | ✅ 지원                | △ 제한 가능 |
| 0.83.x           | ✅ 검증 완료           | △ 동일      |

Expo 상세 호환 표는 [Expo 가이드](expo-guide) 참고.

---

## 문서·패키지 동기화

요구사항 변경 시 다음을 함께 확인한다.

- `packages/react-native-mcp-server/package.json`: `engines`, `peerDependencies`
- 기능 로드맵 § 안정화

---

## 참조 문서 (저장소)

상세 설정·CLI 레퍼런스는 이 사이트가 아닌 저장소 `docs/` 폴더에 있다.

- **[idb-setup](https://github.com/ohah/react-native-mcp/blob/main/docs/references/idb-setup.md)** — idb 설치 및 설정
- **[ADB Reference](https://github.com/ohah/react-native-mcp/blob/main/docs/references/adb.md)** — adb 명령·옵션
- **[IDB Reference](https://github.com/ohah/react-native-mcp/blob/main/docs/references/idb.md)** — idb 명령·옵션
- **[Orientation & Coordinates](https://github.com/ohah/react-native-mcp/blob/main/docs/references/orientation-coordinates.md)** — E2E 방향·좌표 참고
