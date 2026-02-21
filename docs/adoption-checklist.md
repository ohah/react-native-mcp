# 도입 전 체크리스트

React Native MCP 도입 전에 아래 항목을 확인하세요. **자동 검증**은 `doctor` 스크립트로
한 번에 확인할 수 있다 (React Native doctor와 유사한 형식).

---

## 자동 검증 (CI/스크립트)

앱 루트(또는 `package.json`에 `react-native`가 있는 디렉터리)에서 실행:

```bash
npx @ohah/react-native-mcp-server doctor
```

또는 스크립트 직접 실행:

```bash
node node_modules/@ohah/react-native-mcp-server/scripts/doctor.mjs
```

모노레포·패키지 내부에서는 `bun run doctor`로도 실행할 수 있다.

**출력**: Common / React Native / E2E 섹션별로 ✓(통과), ✗(필수 실패), ○(선택·미설치)를 표시한다.

- **성공**: 필수 검사(Node ≥ 24, react-native ≥ 0.74) 모두 통과 시 "All required checks passed.", exit 0.
- **실패**: 필수 항목 하나라도 실패 시 exit 1. CI에서 그대로 사용 가능.

모노레포 내에서 실행할 때:

```bash
cd packages/react-native-mcp-server && bun run doctor
```

(이때 현재 디렉터리의 `package.json`에서 Node·RN 버전을 읽는다.)

---

## 수동 체크리스트

- [ ] **호환성**  
       [compatibility-and-requirements.md](compatibility-and-requirements.md)에서 RN/Expo/Node 버전이
      요구사항을 충족하는지 확인했다.

- [ ] **포트**  
       MCP 서버·앱 기본 포트(12300)가 방화벽/공유기에서 막히지 않는지 확인했다(로컬/팀 네트워크).

- [ ] **Metro**  
       MCP 사용 시 Metro를 `--config`로 프로젝트 `metro.config.js`와 함께 실행할 수 있다(8230 등
      포트 충돌 방지). 자세한 내용: [트러블슈팅](troubleshooting-app-connection.md).

- [ ] **환경 변수**  
       개발 시에는 기본 연결. 프로덕션 번들에서 MCP를 쓰려면 `REACT_NATIVE_MCP_ENABLED=true`로
      Metro 실행 필요 — 보안·노출 검토 후 사용. 자세한 내용: [Expo 가이드](expo-guide.md), [아키텍처](architecture.md).

- [ ] **보안**  
       localhost 또는 제한된 네트워크만 허용하는지 확인했다. 프로덕션에서는 기본 비활성화를
      권장한다. 자세한 내용: [알려진 제한·리스크](known-limitations-and-risks.md#리스크-보안운영).

- [ ] **E2E (idb/adb)**  
       iOS 자동화는 idb(macOS), Android는 adb 설치·경로 확인. 실기기에서는 터치 제한이 있음을
      인지했다. 자세한 내용: [알려진 제한·리스크](known-limitations-and-risks.md), [idb 설정](idb-setup.md).
