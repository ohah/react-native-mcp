# 개발 명령어

```bash
# 개발 서버 시작
bun run dev

# 코드 품질
bun run lint                # oxlint
bun run format              # oxfmt

# 테스트
bun run test:unit           # 유닛 테스트
bun run test:coverage       # 커버리지 포함 테스트
bun run test:e2e -- -p ios     # E2E YAML (데모앱 examples/demo-app/e2e/) — iOS
bun run test:e2e -- -p android # E2E YAML — Android. YAML 문법: [e2e-yaml-reference.md](e2e-yaml-reference.md)
```

## 스크립트 (선택)

Metro 실행 중에만 동작하는 스크립트들. `get_component_source` / 소스맵 검증용.

| 스크립트                                                    | 용도                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `node scripts/verify-component-source.mjs`                  | 번들 + 소스맵으로 원본 위치가 나오는지 검증. `--refs '[...]'` 로 ref 배열 전달 가능. |
| `node scripts/check-range-support.mjs`                      | Metro(또는 번들 서버)가 HTTP Range(206)를 지원하는지 확인.                           |
| `node scripts/symbolicate-stack.mjs [번들URL] [스택파일]`   | 스택 트레이스 파일을 심볼리케이트.                                                   |
| `node scripts/find-app-position.mjs [번들URL] [원본파일명]` | 번들에서 특정 소스 파일로 매핑되는 (line,col) 하나 찾기.                             |

**MCP 도구 호출 테스트** (서버 패키지에서): `node scripts/test-get-component-source-mcp.mjs [--selector 'Text' | --uid '0.1']` — 서버를 stdio로 띄우고 `take_snapshot` / `get_component_source` 호출. 앱 미연결 시 "No React Native app connected" 수신.

공통 라이브러리: `scripts/symbolicate-lib.mjs` (캐시 포함 `getSourcePosition`). 서버 심볼리케이트는 `packages/react-native-mcp-server/src/symbolicate.ts` 에서 사용.

## 이 레포 PR·push (ohah 전용)

이 레포(ohah/react-native-mcp)에서 push·PR은 **ohah** GitHub 계정을 쓴다.

- **SSH remote**: push가 ohah SSH 키를 쓰도록 origin을 `github.com-private` 로 맞춘다. `~/.ssh/config` 에 `Host github.com-private` 가 ohah용 키를 쓰도록 설정되어 있어야 한다.
  ```bash
  git remote set-url origin git@github.com-private:ohah/react-native-mcp.git
  ```
- **gh**: PR 생성·수정 전에 `gh auth switch --hostname github.com --user ohah` 로 ohah로 전환한다. 작업 후 원래 계정으로 복원한다.

자세한 절차는 [.cursor/commands/init-pr.md](../.cursor/commands/init-pr.md), [.cursor/commands/pr.md](../.cursor/commands/pr.md) 를 참고한다.
