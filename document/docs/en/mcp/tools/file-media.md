# File & Media

Tools for pushing files to devices and adding images/videos to the photo library.

## file_push

Push a local file to the simulator/device.

#### Parameters

| Parameter    | Type                 | Required | Description                     |
| ------------ | -------------------- | -------- | ------------------------------- |
| `platform`   | `"ios" \| "android"` | **Yes**  | Target platform                 |
| `localPath`  | `string`             | **Yes**  | Absolute path to the local file |
| `remotePath` | `string`             | **Yes**  | Destination path on the device  |
| `bundleId`   | `string`             | No       | Bundle ID. **Required for iOS** |
| `deviceId`   | `string`             | No       | Device ID                       |

#### Example

```json
// Push to Android
{
  "tool": "file_push",
  "arguments": {
    "platform": "android",
    "localPath": "/tmp/test-data.json",
    "remotePath": "/sdcard/Download/test-data.json"
  }
}

// Push to iOS app container
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

- **iOS**: Files are pushed into the app's sandbox container. `remotePath` is relative to the container root. Requires `bundleId`.
- **Android**: Uses `adb push`. `remotePath` is an absolute path on the device (e.g., `/sdcard/Download/`).
- iOS uses [idb](https://fbidb.io/) for file operations.

---

## add_media

Add images or videos to the simulator/device photo library or gallery.

#### Parameters

| Parameter   | Type                 | Required | Description                                     |
| ----------- | -------------------- | -------- | ----------------------------------------------- |
| `platform`  | `"ios" \| "android"` | **Yes**  | Target platform                                 |
| `filePaths` | `string[]`           | **Yes**  | Absolute paths to image/video files (minimum 1) |
| `deviceId`  | `string`             | No       | Device ID                                       |

#### Example

```json
// Add a single photo
{
  "tool": "add_media",
  "arguments": {
    "platform": "ios",
    "filePaths": ["/tmp/test-photo.jpg"]
  }
}

// Add multiple files
{
  "tool": "add_media",
  "arguments": {
    "platform": "android",
    "filePaths": ["/tmp/photo1.jpg", "/tmp/photo2.png", "/tmp/video.mp4"]
  }
}
```

#### Tips

- Useful for testing image pickers, gallery views, or media upload flows.
- iOS uses `xcrun simctl addmedia`. Android uses `adb push` + media scanner.
- Supports common image formats (JPG, PNG) and video formats (MP4).
