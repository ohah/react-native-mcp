# feat/init-monorepo-and-package-json — 커밋 요약

## 목표

- 모노레포 루트에서 `init` 실행 시 워크스페이스 내 React Native 앱을 자동으로 찾아 설정하도록 함.
- `init`이 앱의 package.json에 `@ohah/react-native-mcp-server`를 devDependency로 넣고, 이어서 패키지 매니저 install을 실행하도록 함.

## 작업 내용

**1. feat(server): init 모노레포 지원 및 package.json 자동 추가**

- `detect.ts`: `getWorkspacePackageDirs`, `findRnAppsInMonorepo`, `detectProjectOrMonorepo` 추가. 루트에 react-native가 없으면 workspaces를 훑어 RN 앱 경로 목록을 구하고, 하나면 그 경로를, 여러 개면 목록을 넘겨 호출측에서 선택하거나 첫 번째를 쓰도록 함. `--app`으로 명시한 경로를 쓰는 분기 추가.
- `add-package.ts` 신규: 앱 루트 package.json에 `@ohah/react-native-mcp-server` devDependency 추가(이미 있으면 스킵), `runInstall`로 패키지 매니저 install 실행.
- `init/index.ts`: `detectProjectOrMonorepo` 사용, effectiveAppRoot·infoToUse 분리, 모노레포일 때 앱 선택(대화형/비대화형), addPackageToApp·runInstall 호출, `noInstall` 옵션 처리.
- CLI: `--app <path>`, `--no-install` 옵션 추가.

**2. test(server): init 모노레포·add-package·runInit 테스트 보강**

- `init-detect.test.ts`: devDependencies 전용 RN, workspaces 단일 경로·glob base 없음·package.json 없는 패키지 제외, devDeps만 RN, 루트 package.json 파손, explicitAppPath 절대/없음/RN 없음, candidateAppRoots 상대 경로 등 추가.
- `init-add-package.test.ts` 신규: addPackageToApp(없음/파손/추가/이미 있음/기존 유지), runInstall(npm, bun).
- `init-run.test.ts` 신규: runInit 실패(RN 없음, --app에 RN 없음), 단일/모노레포/--app 시 package.json devDependency 추가 검증, 이미 Babel·mcp·package.json 있으면 스킵, gitignore 멱등. 테스트는 `noInstall: true`로 실행.

**3. docs: init 모노레포·package 추가·옵션 문서 반영**

- CLI Init 한/영: Step 3에 package.json 추가·install 설명, 옵션표에 `--app`, `--no-install` 추가. 모노레포 섹션을 “루트에서 init만 실행하면 자동 추가·install” 안내로 수정.
- README·README_KO: 모노레포에서 루트에서 init 한 번이면 된다는 문장으로 정리.

## 결과

- 모노레포 루트에서 `npx -y @ohah/react-native-mcp-server init -y` 실행 시 워크스페이스에서 RN 앱을 찾아, 해당 앱 package.json에 패키지를 넣고, 루트에서 install을 실행한 뒤 Babel·MCP·gitignore를 적용함.
- `--app examples/demo-app`으로 앱을 지정하거나, `--no-install`로 package.json만 수정할 수 있음.
- init 관련 테스트가 감지·add-package·runInit을 포함해 보강됨.
