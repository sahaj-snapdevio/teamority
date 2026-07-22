# Solution: Uploaded task/comment images look blurry/washed-out to the uploader only

**Date:** 2026-07-22
**Area:** Inline note images — `components/task/note-image.tsx`

## What changed
Changed the dimming condition on the local-preview `<img>` from "no
`fileKey` yet" to "an upload is actually in flight" (`isUploading`), so it
now matches the spinner's own condition.

## Why it works
The deferred/pending preview (Create Task modal, before submission) is a
lossless local `objectURL` of the exact file that will be uploaded — there
was never a real quality difference, only the extra `opacity-60` making it
look faded. That preview now renders at full opacity, identical to how it
looks once uploaded. The dimmed treatment is reserved for the moment an
upload request is genuinely in flight, where it's paired with the spinner
overlay as a loading indicator rather than a permanent visual downgrade.

## Files touched
- `components/task/note-image.tsx`
