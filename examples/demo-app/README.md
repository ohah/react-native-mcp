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
