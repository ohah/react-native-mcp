# npm에 패키지 릴리즈

버전 태그를 만들고 push하여 npm 배포를 트리거합니다. GitHub Action **Publish to npm**이 태그 push에서 실행됩니다. 릴리즈 노트를 생성하고 GitHub Release를 만듭니다.

## 에이전트가 할 일

1. **패키지 결정**: 사용자가 패키지를 지정하지 않으면 질문합니다: "어떤 패키지를 릴리즈할까요? (server | react-native)"
2. **버전 확인**: 패키지의 `package.json`의 `version`을 확인합니다.
3. **SSH remote**: origin이 `git@github.com-private:ohah/react-native-mcp.git`인지 확인합니다.
4. **gh 계정**: push 전에 `gh api user -q .login`을 확인합니다.
5. **릴리즈 명령 실행** (태그 생성 및 push)
6. **릴리즈 노트**: 이전 태그 이후의 커밋에서 생성합니다.
7. **GitHub Release**: 새 태그로 릴리즈를 생성합니다.
8. **gh 계정 복원**: ohah로 전환했다면 이전 계정으로 복원합니다.
9. **확인**: 태그가 push되었고 **Publish to npm** 워크플로우가 실행될 것이라고 알립니다.

## 참고

- `package.json`의 버전은 태그 전에 이미 커밋되어 있어야 합니다.
- 이 레포는 **ohah** GitHub 계정을 push에 사용합니다 (AGENTS.md 참고).
