# 호환성 및 요구사항

React Native MCP를 도입하기 전에 아래 요구사항을 충족하는지 확인하세요. 자동 검증은
[도입 전 체크리스트](adoption-checklist.md)의 스크립트를 사용할 수 있다.

---

## 환경별 요구사항

| 항목                 | 요구사항                                                 | 비고                                                                             |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Node**             | ≥ 24                                                     | MCP 서버 실행 환경. `engines.node` 기준.                                         |
| **Bun**              | ≥ 1.0.0 (선택)                                           | Node 대신 사용 시.                                                               |
| **React Native**     | **≥ 0.74** (New Architecture 기준)                       | 0.83.x 검증 완료. [Expo 사용 시](expo-guide.md)는 해당 가이드 참고.              |
| **New Architecture** | 지원 (최소 0.74)                                         | Fabric 0.83.x에서 검증 완료.                                                     |
| **Hermes**           | 사용 가정                                                | React Native 기본 엔진.                                                          |
| **Expo**             | Dev Client ✅ / Expo Go △ / EAS production 시 MCP 비활성 | 상세: [Expo 검증 가이드](expo-guide.md).                                         |
| **OS (MCP 서버)**    | macOS (idb·iOS), Windows/Linux (Android adb)             | iOS 시뮬레이터 자동화는 macOS + idb 필요.                                        |
| **iOS 실기기**       | 터치 주입 미지원                                         | 시뮬레이터 권장. 제한사항: [알려진 제한·리스크](known-limitations-and-risks.md). |

---

## 버전 매트릭스 (요약)

| React Native     | Bare / Expo Dev Client | Expo Go     |
| ---------------- | ---------------------- | ----------- |
| 0.74+ (New Arch) | ✅ 지원                | △ 제한 가능 |
| 0.83.x           | ✅ 검증 완료           | △ 동일      |

Expo 상세 호환 표는 [expo-guide.md](expo-guide.md#호환성-요약) 참고.

---

## 문서·패키지 동기화

요구사항 변경 시 다음을 함께 확인한다.

- `packages/react-native-mcp-server/package.json`: `engines`, `peerDependencies`
- [기능 로드맵](feature-roadmap.md) § 안정화
