# Pull Request 생성 또는 업데이트

현재 브랜치 기준으로 PR 생성·업데이트. **AGENTS.MD의 PR 규칙**을 따른다.

## 언어

PR 제목, 본문, `branch-summary.md` 모두 **한국어**로 작성한다.

## 에이전트가 할 일

1. **브랜치·PR 상태**: `git branch --show-current`, `gh pr list --head <현재브랜치> --state all`
2. **이미 열린 PR이 있으면**: 새 브랜치·새 PR 만들지 않음. 현재 브랜치에 커밋 추가 후 push.
3. **base**: 사용자가 지정하면 그 브랜치를 머지 대상으로 사용.
   - **현재 브랜치와 base가 같으면**: 현재 브랜치에서 새 브랜치를 만들어 PR head로 사용.
4. **본문**: `branch-summary.md`가 있으면 PR 본문으로 사용. 한국어로 작성.
5. **이슈 연결**: `gh issue list --state open --limit 50` 실행. 관련 이슈 있으면 본문에 `Relates to #<번호>` 또는 `Fixes #<번호>` 추가.
6. **PR 생성·업데이트**:
   - 열린 PR 없음 → `gh pr create --head <현재브랜치> --base <base> --title "<제목>" --body-file branch-summary.md --assignee @me`
   - 열린 PR 있음 → 본문(필요 시 base) 업데이트.
7. **Push**: 푸시 안 된 커밋 있으면 `git push origin <현재브랜치>`.
8. **담당자**: PR 생성 시 항상 `--assignee @me`.
9. **라벨**: `gh label list` 확인 후 PR 타입에 맞는 라벨 추가 (feat → enhancement, fix → bug, docs → documentation 등).

## gh 계정·SSH (이 레포)

- **origin**: `git remote set-url origin git@github.com-private:ohah/react-native-mcp.git`
- **gh**: push·`gh pr create` 전 `gh api user -q .login`으로 사용자 확인. `ohah` 아니면 `gh auth switch --hostname github.com --user ohah` 후 작업. 작업 끝나면 이전 사용자로 복원.

## PR 제목 규칙

- 사용자가 제목 지정 → 그대로 사용.
- 이슈 참조 (예: `/pr fixes #123`) → `[#123]` 접두사 + 짧은 주제.
- 둘 다 없음 → 한국어로 짧고 명령형 주제.

## PR 본문 형식

`branch-summary.md`를 본문으로 사용. 포함 내용:

- **제목(목적)**: 이 PR의 목적
- **작업 내용**: 무엇을·왜 변경했는지 산문체로 작성

## 참고

- 현재 브랜치에 열린 PR이 있으면 새 브랜치·PR 만들지 않음.
- PR 본문 업데이트 후 푸시 안 된 커밋 있으면 push.
