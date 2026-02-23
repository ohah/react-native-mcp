# Utilities

Steps for clipboard operations, running JavaScript, and adding media.

## copyText

Read the text of the element matching the selector and store it in the app client internal clipboard (OS clipboard is not used). Use with `pasteText`.

#### Parameters

| Field    | Type   | Required | Description          |
| -------- | ------ | -------- | -------------------- |
| selector | string | Yes      | Element to read from |

#### Example

```yaml
- copyText:
    selector: '#invite-code'
```

---

## pasteText

Paste the content stored by `copyText` into the currently focused input via `input_text`. Reuses idb/adb input flow on both platforms.

No parameters.

#### Example

```yaml
- pasteText:
```

#### Tips

- Platform-agnostic. `copyText` stores text in an internal variable; OS clipboard is not used.
- Subject to the same Unicode/keyboard limits as `inputText`.

---

## evaluate

Run JavaScript in the app context.

#### Parameters

| Field  | Type   | Required | Description    |
| ------ | ------ | -------- | -------------- |
| script | string | Yes      | JS code to run |

#### Example

```yaml
- evaluate:
    script: 'global.__testFlag = true;'
```

---

## addMedia

Add media files (images, videos) to the device gallery.

#### Parameters

| Field | Type     | Required | Description                            |
| ----- | -------- | -------- | -------------------------------------- |
| paths | string[] | Yes      | Array of local file paths (min 1 item) |

#### Example

```yaml
- addMedia:
    paths: ['/tmp/photo.jpg', '/tmp/video.mp4']
```
