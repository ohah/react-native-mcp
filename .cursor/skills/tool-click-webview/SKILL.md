---
name: tool-click-webview
description: MCP click_webview 호출 또는 앱 내 WebView 안의 DOM 요소 클릭할 때 사용.
---

# click_webview

## 동작

- 서버가 **eval** 전송: `__REACT_NATIVE_MCP__.clickInWebView(webViewId, selector)`. 앱은 해당 **webViewId**로 등록된 WebView ref를 찾고, WebView DOM에서 `document.querySelector(selector).click()`을 실행하는 **injectJavaScript** 호출.
- 앱에서 `__REACT_NATIVE_MCP__.registerWebView(ref, id)` 호출 필요(예: react-native-webview). **webViewId**와 **selector**(CSS) 필수.
