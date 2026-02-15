---
name: tool-webview-evaluate-script
description: MCP webview_evaluate_script 호출 또는 앱 내 WebView에서 임의 JS 실행·결과 수신할 때 사용.
---

# webview_evaluate_script

## 동작

- 서버가 **eval** 전송: `__REACT_NATIVE_MCP__.evaluateInWebViewAsync(webViewId, script)`. 앱은 해당 **webViewId**로 등록된 WebView ref를 찾고, WebView 내부에서 **injectJavaScript**로 스크립트를 실행한 뒤, 결과를 postMessage로 돌려준다.
- 앱에서 `__REACT_NATIVE_MCP__.registerWebView(ref, id)` 호출 필요(예: react-native-webview). Babel이 testID 있는 WebView에 ref·onMessage를 자동 주입하므로 앱에 MCP 전용 코드 없이 사용 가능.
- **webViewId**(앱에서 등록한 id)와 **script**(WebView 안에서 실행할 JS 표현식) 필수. 결과를 받으려면 앱 onMessage가 `createWebViewOnMessage`로 감싸져 있어야 함(Babel 자동 주입 또는 수동 적용).

## 활용

- DOM 조회/클릭: `document.querySelector('button').click()`, `document.querySelector('h1').innerText` 등.
- 값 반환: 스크립트가 표현식으로 평가되면 그 값이 도구 응답으로 반환됨.
