# Bug: Uploaded task/comment images look blurry/washed-out to the uploader only

**Date:** 2026-07-22
**Area:** Inline note images — `components/task/note-image.tsx`

## Symptom
After pasting/dropping an image into a task description or comment, the
image looks blurry/faded to the person who uploaded it. Other users who
open the same task afterward see the same image crisp and normal.

## Where
`NoteImageView` (`components/task/note-image.tsx`) — the branch rendering
the local preview while `fileKey` is not yet set.

## Root cause
The `noteImage` node has two distinct client-only states before a real
`fileKey` exists:
- **Deferred/pending** (Create Task modal, `uploading: false`) — the file
  is only queued; nothing has been uploaded yet. `insertPending()`
  (`hooks/use-note-image-upload.ts`) sets `uploading: false` here.
- **Actively uploading** (`uploading: true`) — a request is in flight,
  paired with a spinner overlay.

The render logic branched only on `fileKey` truthiness: any time `fileKey`
was null, the `<img>` got `opacity-60`, regardless of which of the two
states above was active. In the Create Task modal, a pasted image sits in
the deferred state — often for as long as the user takes to fill out the
rest of the form — with no spinner (since `uploading` is `false`) and no
indication anything is "loading," just a permanently dimmed image. That
faded look is what got reported as "blurry." Once the task is created and
`flushPending()` uploads the file and patches the node with the real
`fileKey`, the image renders at full quality — which is what every other
viewer (and the uploader, after reopening the task) sees.

The code's own comment ("A 'pending' deferred image ... just shows its
local preview") already stated the intended behavior — the implementation
just didn't match it.
