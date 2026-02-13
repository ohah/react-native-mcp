# React Native MCP Demo App

MCP 서버 연동·테스트용 최소 React Native 예제 앱입니다.

## 요구 사항

- Node.js >= 20
- React Native 개발 환경 (Xcode, Android Studio, CocoaPods 등)
- 모노레포 루트에서 `bun install` 완료

## 실행

```bash
# 루트에서 의존성 설치
cd ../..
bun install

# 데모 앱 디렉터리로 이동
cd examples/demo-app

# iOS: Pod 설치 후 실행
cd ios && pod install && cd ..
bun run ios

# Android
bun run android

# Metro 번들러만 실행
bun run start
```

## 앱 이름

- **표시 이름**: React Native MCP Demo
- **iOS 번들 ID**: org.reactnativemcp.demo
- **Android 패키지**: com.reactnativemcp.demo

## testID

MCP/자동화 테스트용으로 다음 testID가 설정되어 있습니다.

- `demo-app-title`: 화면 제목
- `demo-app-subtitle`: 부제
- `demo-app-counter-button`: 카운터 버튼

## Transformer 적용 확인

Metro 커스텀 transformer(AppRegistry 래퍼 + testID 자동 주입)가 실제로 적용됐는지 확인하는 방법입니다.

### 1) 번들 출력으로 확인 (권장)

모노레포 루트에서:

```bash
./scripts/verify-transformer.sh
# 또는 특정 앱 경로 지정
./scripts/verify-transformer.sh examples/demo-app
```

스크립트가 번들을 한 번 빌드한 뒤, 다음이 포함돼 있는지 검사합니다.

- `__REACT_NATIVE_MCP__`: AppRegistry가 MCP 래퍼로 감싸졌는지
- `testID:"..."`: JSX에 testID가 주입됐는지

수동으로 확인하려면:

```bash
cd examples/demo-app
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/out.js --reset-cache
grep -o '__REACT_NATIVE_MCP__' /tmp/out.js | head -1   # 있으면 적용됨
grep -oE 'testID:\s*"[^"]+"' /tmp/out.js | head -5     # 주입된 testID 예시
```

### 2) 앱 실행 후 런타임으로 확인

- **testID**: 앱을 실행한 뒤 E2E/Detox에서 `testID="demo-app-title"` 또는 자동 주입된 `App-0-View` 등으로 요소를 조회해 보면 됩니다.
- **AppRegistry 래퍼**: MCP 서버로 앱에 연결했을 때, 등록된 앱 컴포넌트가 MCP 쪽에서 보이면 래퍼가 적용된 것입니다.
