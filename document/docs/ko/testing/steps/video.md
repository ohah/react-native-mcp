# 비디오

디바이스/시뮬레이터 화면 녹화 시작·중지 스텝(iOS는 idb, Android는 adb screenrecord). 동시에 하나의 녹화만 가능합니다.

## startRecording

화면 녹화를 시작합니다. `stopRecording`을 호출할 때 파일이 저장됩니다.

#### Parameters

| 필드 | 타입   | 필수   | 설명                                                                                                                       |
| ---- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| path | string | 아니오 | 저장 경로(YAML 파일 또는 출력 디렉터리 기준). 생략 시 출력 디렉터리의 `e2e-recording.mp4`. 현재 작업 디렉터리 아래여야 함. |

#### Example

```yaml
setup:
  - startRecording:
      path: ./results/full-run.mp4

steps:
  - tap:
      selector: '#start'

teardown:
  - stopRecording: {}
  - terminate: org.example.app
```

#### Tips

- `setup`에서 `startRecording`, `teardown`에서 `stopRecording`을 쓰면 전체 실행이 녹화됩니다. teardown은 스텝 실패 시에도 실행되므로 녹화는 항상 중지됩니다.
- `path`를 생략하면 `outputDir/e2e-recording.mp4`로 저장됩니다(예: `-o e2e-artifacts/yaml-results` 사용 시 `e2e-artifacts/yaml-results/e2e-recording.mp4`).

---

## stopRecording

현재 녹화를 중지하고 파일을 저장합니다.

#### Parameters

없음. 빈 객체 `stopRecording: {}` 또는 스칼라 `stopRecording: null` 사용.

#### Example

```yaml
- stopRecording: {}
```

#### Tips

- 녹화를 시작하지 않았을 때도 teardown에서 호출해도 안전합니다(no-op).
- 중지 후 저장 경로는 러너 출력에 표시됩니다.
