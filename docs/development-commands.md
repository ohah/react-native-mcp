# 개발 명령어

```bash
# 개발 서버 시작
bun run dev

# 코드 품질
bun run lint                # oxlint
bun run format              # oxfmt

# 테스트
bun run test:unit           # 유닛 테스트
bun run test:coverage           # 커버리지 포함 테스트
```

## 이 레포 PR·push (ohah 전용)

이 레포(ohah/react-native-mcp)에서 push·PR은 **ohah** GitHub 계정을 쓴다.

- **SSH remote**: push가 ohah SSH 키를 쓰도록 origin을 `github.com-private` 로 맞춘다. `~/.ssh/config` 에 `Host github.com-private` 가 ohah용 키를 쓰도록 설정되어 있어야 한다.
  ```bash
  git remote set-url origin git@github.com-private:ohah/react-native-mcp.git
  ```
- **gh**: PR 생성·수정 전에 `gh auth switch --hostname github.com --user ohah` 로 ohah로 전환한다. 작업 후 원래 계정으로 복원한다.

자세한 절차는 [.cursor/commands/init-pr.md](../.cursor/commands/init-pr.md), [.cursor/commands/pr.md](../.cursor/commands/pr.md) 를 참고한다.
