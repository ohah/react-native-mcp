# 유틸리티

클립보드 조작, JavaScript 실행, 미디어 추가 관련 스텝.

## copyText

셀렉터로 지정한 요소의 텍스트를 읽어 **앱 클라이언트 내부 클립보드**에 저장한다. OS 클립보드는 사용하지 않는다. `pasteText`와 쌍으로 사용.

#### Parameters

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 텍스트를 읽을 요소 |

#### Example

```yaml
- copyText:
    selector: '#invite-code'
```

---

## pasteText

`copyText`로 저장한 내용을 현재 포커스된 입력 필드에 **input_text**로 붙여 넣는다. iOS/Android 모두 idb·adb 입력 흐름 재사용.

파라미터 없음.

#### Example

```yaml
- pasteText:
```

#### Tips

- 플랫폼 무관. `copyText`는 내부 변수에 텍스트 저장. OS 클립보드 미사용.
- 한글/유니코드는 `inputText` 제한에 따름.

---

## evaluate

앱 컨텍스트에서 JavaScript를 실행한다.

#### Parameters

| 필드   | 타입   | 필수 | 설명           |
| ------ | ------ | ---- | -------------- |
| script | string | ✓    | 실행할 JS 코드 |

#### Example

```yaml
- evaluate:
    script: 'global.__testFlag = true;'
```

---

## addMedia

디바이스 갤러리에 미디어 파일(이미지, 동영상)을 추가한다.

#### Parameters

| 필드  | 타입     | 필수 | 설명                                  |
| ----- | -------- | ---- | ------------------------------------- |
| paths | string[] | ✓    | 추가할 로컬 파일 경로 배열 (1개 이상) |

#### Example

```yaml
- addMedia:
    paths: ['/tmp/photo.jpg', '/tmp/video.mp4']
```
