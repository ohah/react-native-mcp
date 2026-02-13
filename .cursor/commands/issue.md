# GitHub 이슈 생성

현재 레포에 GitHub 이슈를 생성한다. **언어·라벨·담당자** 규칙을 따른다.

## 언어

이슈 제목, 본문 모두 **한국어**로 작성한다.

## 에이전트가 할 일

1. **제목**: 사용자가 지정하면 그대로 사용. 미지정 시 사용자 요청을 반영한 한국어 주제 (짧고 명령형, 50자 이하 권장).
2. **본문**: 사용자가 본문을 지정하면 사용. 미지정 시 목적·상황을 한두 문단으로 요약해 작성.
3. **gh 계정**: `gh issue create` 전 `gh api user -q .login`으로 사용자 확인. `ohah` 아니면 `gh auth switch --hostname github.com --user ohah` 후 작업. 작업 끝나면 이전 사용자로 복원.
4. **라벨**: `gh label list`로 사용 가능 라벨 확인. 타입에 맞게 선택.
   - 버그 → `bug`
   - 기능/개선 → `enhancement`
   - 문서 → `documentation`
   - 기타 → 사용자 지정 또는 생략
5. **이슈 생성**: `gh issue create --title "<제목>" --body "<본문>" --assignee @me [--label "<라벨>"]`
   - 본문이 길거나 줄바꿈이 많으면 `--body-file issue-body.md` 사용 (파일 생성 후 전달, 작업 후 삭제 가능).

## gh 계정·SSH (이 레포)

- **origin**: `git remote set-url origin git@github.com-private:ohah/react-native-mcp.git`
- **gh**: 이슈 생성 전 사용자 확인. `ohah`가 아니면 위와 같이 전환 후 작업하고 끝나면 복원.

## 참고

- 기존 이슈 목록 확인: `gh issue list --state open --limit 20`
- 이슈 번호로 조회: `gh issue view <번호>`
