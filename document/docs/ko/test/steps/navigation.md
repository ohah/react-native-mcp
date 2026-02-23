# 내비게이션 & 디바이스

버튼 누르기, 뒤로/홈, 딥링크, GPS 위치 설정, 앱 상태 초기화 관련 스텝.

## pressButton

하드웨어/소프트 버튼을 누른다.

#### Parameters

| 필드   | 타입   | 필수 | 설명                            |
| ------ | ------ | ---- | ------------------------------- |
| button | string | ✓    | 버튼 식별자(예: `home`, `back`) |

#### Example

```yaml
- pressButton:
    button: back
```

---

## back

뒤로가기 버튼을 누른다. `pressButton: { button: BACK }` 의 단축 스텝.

파라미터 없음.

#### Example

```yaml
- back:
```

---

## home

홈 버튼을 누른다. `pressButton: { button: HOME }` 의 단축 스텝.

파라미터 없음.

#### Example

```yaml
- home:
```

---

## hideKeyboard

키보드를 닫는다. iOS에서는 Escape 키(HID 41), Android에서는 BACK 키를 보낸다.

파라미터 없음.

#### Example

```yaml
- hideKeyboard:
```

---

## openDeepLink

딥 링크를 연다.

#### Parameters

| 필드 | 타입   | 필수 | 설명        |
| ---- | ------ | ---- | ----------- |
| url  | string | ✓    | 딥 링크 URL |

#### Example

```yaml
- openDeepLink:
    url: myapp://screen/settings
```

---

## setLocation

시뮬레이터(iOS) 또는 에뮬레이터(Android)에 GPS 위치를 설정한다.

#### Parameters

| 필드      | 타입   | 필수 | 설명              |
| --------- | ------ | ---- | ----------------- |
| latitude  | number | ✓    | 위도 (-90 ~ 90)   |
| longitude | number | ✓    | 경도 (-180 ~ 180) |

#### Example

```yaml
- setLocation:
    latitude: 37.5665
    longitude: 126.978
```

#### Tips

- **iOS**: 시뮬레이터 모두 지원 (`idb set-location`).
- **Android**: **에뮬레이터 전용**. `adb emu geo fix`는 실기기에서 동작하지 않음.

---

## clearState

앱 데이터 또는 권한을 초기화한다.

#### Parameters

| 필드 | 타입   | 필수 | 설명                                  |
| ---- | ------ | ---- | ------------------------------------- |
| (값) | string | ✓    | iOS: bundle ID. Android: 패키지 이름. |

#### Example

```yaml
- clearState: org.reactnativemcp.demo
```

#### Tips

| 플랫폼      | 동작                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **iOS**     | `simctl privacy reset all` — 권한/프라이버시만 리셋. 앱 샌드박스(문서·캐시)는 삭제되지 않음. 완전 초기화는 앱 삭제 후 재설치 필요. |
| **Android** | `pm clear` — 앱 데이터 전부 삭제(AsyncStorage, SharedPreferences 등).                                                              |
