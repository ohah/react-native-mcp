# File & Media

디바이스에 파일을 전송하거나 사진 라이브러리에 이미지/동영상을 추가하는 도구입니다.

## file_push

로컬 파일을 시뮬레이터/디바이스에 전송합니다.

#### Parameters

| Parameter    | Type                 | Required | Description                  |
| ------------ | -------------------- | -------- | ---------------------------- |
| `platform`   | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                  |
| `localPath`  | `string`             | **Yes**  | 로컬 파일의 절대 경로        |
| `remotePath` | `string`             | **Yes**  | 디바이스 내 대상 경로        |
| `bundleId`   | `string`             | No       | 번들 ID. **iOS의 경우 필수** |
| `deviceId`   | `string`             | No       | 디바이스 ID                  |

#### Example

```json
// Android에 파일 전송
{
  "tool": "file_push",
  "arguments": {
    "platform": "android",
    "localPath": "/tmp/test-data.json",
    "remotePath": "/sdcard/Download/test-data.json"
  }
}

// iOS 앱 컨테이너에 파일 전송
{
  "tool": "file_push",
  "arguments": {
    "platform": "ios",
    "localPath": "/tmp/config.json",
    "remotePath": "Documents/config.json",
    "bundleId": "com.myapp"
  }
}
```

#### Tips

- **iOS**: 파일은 앱의 샌드박스 컨테이너 내부로 전송됩니다. `remotePath`는 컨테이너 루트 기준 상대 경로입니다. `bundleId`가 필요합니다.
- **Android**: `adb push`를 사용합니다. `remotePath`는 디바이스의 절대 경로입니다 (예: `/sdcard/Download/`).
- iOS는 파일 작업에 [idb](https://fbidb.io/)를 사용합니다.

---

## add_media

시뮬레이터/디바이스의 사진 라이브러리 또는 갤러리에 이미지나 동영상을 추가합니다.

#### Parameters

| Parameter   | Type                 | Required | Description                               |
| ----------- | -------------------- | -------- | ----------------------------------------- |
| `platform`  | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                               |
| `filePaths` | `string[]`           | **Yes**  | 이미지/동영상 파일의 절대 경로 (최소 1개) |
| `deviceId`  | `string`             | No       | 디바이스 ID                               |

#### Example

```json
// 사진 1장 추가
{
  "tool": "add_media",
  "arguments": {
    "platform": "ios",
    "filePaths": ["/tmp/test-photo.jpg"]
  }
}

// 여러 파일 추가
{
  "tool": "add_media",
  "arguments": {
    "platform": "android",
    "filePaths": ["/tmp/photo1.jpg", "/tmp/photo2.png", "/tmp/video.mp4"]
  }
}
```

#### Tips

- 이미지 피커, 갤러리 뷰, 미디어 업로드 플로우를 테스트할 때 유용합니다.
- iOS는 `xcrun simctl addmedia`를 사용합니다. Android는 `adb push` + 미디어 스캐너를 사용합니다.
- 일반적인 이미지 포맷(JPG, PNG)과 동영상 포맷(MP4)을 지원합니다.
