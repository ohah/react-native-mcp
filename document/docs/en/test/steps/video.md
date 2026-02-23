# Video

Steps for starting and stopping screen recording on the device/simulator (idb on iOS, adb screenrecord on Android). Only one recording can be active at a time.

## startRecording

Start screen recording. The file is written when you call `stopRecording`.

#### Parameters

| Field | Type   | Required | Description                                                                                                                                         |
| ----- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| path  | string | No       | Save path (relative to YAML file or output dir). Default: `e2e-recording.mp4` in the output directory. Must be under the current working directory. |

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

- Use `startRecording` in `setup` and `stopRecording` in `teardown` so the full run is captured. Teardown runs even on step failure, so the recording is always stopped.
- If you omit `path`, the file is saved as `outputDir/e2e-recording.mp4` (e.g. `e2e-artifacts/yaml-results/e2e-recording.mp4` when using `-o e2e-artifacts/yaml-results`).

---

## stopRecording

Stop the current recording and save the file.

#### Parameters

None. Use an empty object: `stopRecording: {}` or scalar: `stopRecording: null`.

#### Example

```yaml
- stopRecording: {}
```

#### Tips

- Safe to call in teardown even when no recording was started (no-op).
- After stopping, the path is reported in the runner output.
