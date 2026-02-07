# Pull Request 생성 또는 업데이트

현재 브랜치에 대한 PR을 생성하거나 업데이트합니다. 아래 단계를 따르세요.

## 에이전트가 할 일

1. **현재 브랜치 및 PR 상태 확인**: `git branch --show-current`, `gh pr list --head <current-branch> --state all`
2. **이미 열린 PR이 있는 경우**: 새 브랜치나 새 PR을 만들지 않습니다. 현재 브랜치에 새 커밋을 추가하고 push합니다.
3. **base 결정**: 사용자가 base 브랜치를 지정하면 그것을 머지 대상으로 사용합니다.
   - **현재 브랜치와 base가 같은 경우** → 현재 브랜치에서 새 브랜치를 만들어 PR의 head로 사용합니다.
4. **본문 준비**: `branch-summary.md`가 있으면 PR 본문으로 사용합니다.
5. **관련 이슈 연결**: `gh issue list --state open --limit 50` 실행. 관련 이슈가 있으면 PR 본문에 `Relates to #<번호>` 또는 `Fixes #<번호>` 추가.
6. **PR 생성 또는 업데이트**:
   - 열린 PR 없음 → `gh pr create --head <current-branch> --base <base> --title "<제목>" --body-file branch-summary.md --assignee @me`
   - 열린 PR 있음 → 본문 업데이트 (필요시 base도 PATCH로 변경).
7. **Push**: 푸시하지 않은 커밋이 있으면 `git push origin <current-branch>`.
8. **담당자**: PR 생성 시 항상 `--assignee @me` 추가.
9. **라벨**: PR 생성/업데이트 후 `gh label list`를 확인하고 **PR 타입에 맞는 라벨을 자동으로 추가** (feat → enhancement, fix → bug, docs → documentation 등).

## gh 계정 및 SSH remote (이 레포 전용)

이 레포(ohah/react-native-mcp)는 **ohah** GitHub 계정으로 push와 PR을 사용합니다.

- **SSH remote**: push가 ohah SSH 키를 쓰도록 origin을 `github.com-private`로 맞춥니다.
  ```bash
  git remote set-url origin git@github.com-private:ohah/react-native-mcp.git
  ```
- **gh auth switch**: push나 `gh pr create` 전에 `gh api user -q .login`으로 현재 사용자를 확인합니다. `ohah`가 아니면 `gh auth switch --hostname github.com --user ohah`로 전환하고 이전 로그인을 기억합니다.
- **작업 후**: ohah로 전환했다면 `gh auth switch --hostname github.com --user <이전_사용자>`로 복원합니다.

## PR 제목 규칙

- **사용자가 제목을 제공한 경우**: 그대로 사용합니다.
- **사용자가 이슈 참조를 제공한 경우** (예: `/pr fixes #123`): `[#123]` 접두사와 짧은 주제를 사용합니다.
- **둘 다 없는 경우**: 영어로 짧고 명령형인 주제를 사용합니다.

## PR 본문 형식

`branch-summary.md`를 PR 본문으로 사용합니다. 최소한 다음을 포함해야 합니다:

- **제목** (또는 목적): 이 PR의 목적.
- **작업 내용** (또는 설명): 무엇을 변경했고 왜 변경했는지 산문체로 작성.

## 참고

- **기존 PR**: 현재 브랜치에 이미 열린 PR이 있으면 새 브랜치/PR을 만들지 않습니다.
- **언어**: PR 제목과 본문은 **영어**로 작성합니다.
- **Push**: PR 본문 업데이트 후 푸시하지 않은 커밋이 있으면 push합니다.
