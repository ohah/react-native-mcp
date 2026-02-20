---
description: E2E 테스트 결과를 웹 대시보드로 확인. 최근 런, 스텝 상세, flaky 표시.
---

# E2E 대시보드

E2E 테스트를 **dashboard** 리포터로 실행하면 결과가 `runs.json`에 쌓이고, 웹 대시보드에서 최근 런·스텝 상세·flaky를 볼 수 있습니다.

## 사용 방법

### 1. 대시보드로 테스트 실행

출력 디렉터리(`-o`)와 리포터(`-r dashboard`)를 지정해 실행합니다.

```bash
bun run build
bun packages/react-native-mcp-server/dist/index.js test run <YAML경로> -r dashboard -o <출력디렉터리>
```

예 (모노레포 루트):

```bash
bun run dashboard
```

위 스크립트는 `e2e-results`에 결과를 쓰고, 실행이 끝나면 브라우저에서 대시보드를 엽니다.

### 2. 이미 쌓인 결과만 보기

테스트를 다시 돌리지 않고, 기존 결과만 서빙·브라우저로 열 때:

```bash
bun run dashboard:show
```

또는 CLI로 출력 디렉터리와 포트를 지정:

```bash
bun packages/react-native-mcp-server/dist/index.js test report show -o e2e-results -p 9323
```

기본 포트는 **9323**이며, 브라우저에서 `http://127.0.0.1:9323/` 로 접속하면 됩니다.

## 대시보드에서 보이는 것

- **Latest run**: 마지막 런의 passed/failed/skipped 개수, 소요 시간
- **Recent runs**: 최근 런 목록. **행을 클릭**하면 해당 런의 스위트·스텝이 펼쳐짐
- **스텝 상세**: 각 스텝 옆 **Detail**을 클릭하면 실행한 스텝 payload(JSON) 또는 라벨이 펼쳐짐 (실패 시 에러 메시지·스크린샷 파일명 포함)
- **Flaky**: 최근 20회 런 안에서 같은 스텝이 pass 1회 이상 + fail 1회 이상인 경우 표시

데이터는 `&lt;출력디렉터리&gt;/dashboard/runs.json`에 최대 100개 런까지 유지됩니다.
