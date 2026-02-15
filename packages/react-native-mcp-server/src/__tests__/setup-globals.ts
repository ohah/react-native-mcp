/**
 * 테스트 전역 설정 — runtime.js가 XHR/fetch 패치를 적용할 수 있도록
 * XMLHttpRequest mock을 미리 등록한다. bunfig.toml preload로 사용.
 */

// runtime.js가 존재하지 않는 XHR 환경에서도 패치할 수 있도록 mock 클래스 등록
if (typeof globalThis.XMLHttpRequest === 'undefined') {
  class MockXMLHttpRequest {
    status = 0;
    statusText = '';
    responseText = '';
    _listeners: Record<string, Array<() => void>> = {};

    open(_method: string, _url: string) {}
    send(_body?: unknown) {}
    setRequestHeader(_name: string, _value: string) {}

    addEventListener(event: string, cb: () => void) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(cb);
    }

    getAllResponseHeaders() {
      return '';
    }

    /** 테스트 헬퍼: 지정 이벤트의 모든 리스너를 실행 */
    _fireEvent(event: string) {
      (this._listeners[event] || []).forEach((cb) => cb());
    }
  }
  (globalThis as Record<string, unknown>).XMLHttpRequest = MockXMLHttpRequest;
}
