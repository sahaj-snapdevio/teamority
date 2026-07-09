"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

// Image `File`s from a clipboard/drop FileList.
export function imageFilesFromList(list: FileList | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter((f) => f.type.startsWith("image/"));
}

function newTempId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

interface UploadedImage {
  fileKey: string;
  attachmentId: string;
}

/**
 * Inline paste/drop/pick image support for a Tiptap editor that uses the
 * `noteImage` node (see components/task/note-image.tsx). Uploads reuse the
 * task attachments endpoint (`?inline=true`).
 *
 * Two modes:
 *  - **Immediate** (`taskId` set): each image uploads right away and its node
 *    is patched with the real storage key.
 *  - **Deferred** (`deferred: true`, no taskId yet — e.g. the create modal):
 *    images are inserted as local previews only; call `flushPending(taskId)`
 *    after the task is created to upload them and rewrite the description.
 */
export function useNoteImageUpload(opts: {
  taskId?: string;
  deferred?: boolean;
}) {
  const editorRef = React.useRef<Editor | null>(null);
  const taskIdRef = React.useRef(opts.taskId);
  taskIdRef.current = opts.taskId;
  const deferredRef = React.useRef(opts.deferred);
  deferredRef.current = opts.deferred;

  // tempId -> File, for deferred uploads flushed after task creation.
  const pendingRef = React.useRef<Map<string, File>>(new Map());
  const [uploadCount, setUploadCount] = React.useState(0);

  const setEditor = React.useCallback((e: Editor | null) => {
    editorRef.current = e;
  }, []);

  // Update / remove the noteImage node identified by its (temp) attachmentId.
  function patchNode(matchId: string, attrs: Record<string, unknown> | null) {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const { state, view } = editor;
    let pos = -1;
    state.doc.descendants((node, p) => {
      if (node.type.name === "noteImage" && node.attrs.attachmentId === matchId) {
        pos = p;
        return false;
      }
      return true;
    });
    if (pos < 0) return;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    const tr = attrs
      ? state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })
      : state.tr.delete(pos, pos + node.nodeSize);
    view.dispatch(tr);
  }

  function insertPlaceholder(tempId: string, previewSrc: string, alt: string, uploading: boolean) {
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({
        type: "noteImage",
        attrs: { attachmentId: tempId, uploading, previewSrc, alt },
      })
      .run();
  }

  async function uploadOne(taskId: string, file: File): Promise<UploadedImage | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("inline", "true");
    const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: fd });
    if (!res.ok) return null;
    const data = await res.json();
    const fileKey = data?.attachment?.key as string | undefined;
    const attachmentId = data?.attachment?.id as string | undefined;
    if (!fileKey || !attachmentId) return null;
    return { fileKey, attachmentId };
  }

  // Immediate mode: insert placeholder, upload, patch (or remove on failure).
  async function insertAndUpload(file: File) {
    const taskId = taskIdRef.current;
    if (!taskId) return;
    const tempId = newTempId();
    const previewSrc = URL.createObjectURL(file);
    setUploadCount((n) => n + 1);
    insertPlaceholder(tempId, previewSrc, file.name, true);
    try {
      const up = await uploadOne(taskId, file);
      if (!up) throw new Error("upload failed");
      patchNode(tempId, {
        attachmentId: up.attachmentId,
        fileKey: up.fileKey,
        uploading: false,
        previewSrc: null,
      });
    } catch {
      patchNode(tempId, null);
      toast.error("Couldn't upload image");
    } finally {
      URL.revokeObjectURL(previewSrc);
      setUploadCount((n) => Math.max(0, n - 1));
    }
  }

  // Deferred mode: insert a local preview only; remember the File for flush.
  function insertPending(file: File) {
    const tempId = newTempId();
    const previewSrc = URL.createObjectURL(file);
    pendingRef.current.set(tempId, file);
    insertPlaceholder(tempId, previewSrc, file.name, false);
  }

  function handleImageFiles(files: File[]) {
    for (const f of files) {
      if (deferredRef.current) insertPending(f);
      else if (taskIdRef.current) void insertAndUpload(f);
    }
  }

  // Stable handlers (created once) that always call the latest logic.
  const handleFilesRef = React.useRef(handleImageFiles);
  handleFilesRef.current = handleImageFiles;

  const handlePaste = React.useCallback((_view: unknown, event: ClipboardEvent) => {
    const files = imageFilesFromList(event.clipboardData?.files);
    if (files.length === 0) return false;
    event.preventDefault();
    handleFilesRef.current(files);
    return true;
  }, []);

  const handleDrop = React.useCallback((_view: unknown, event: DragEvent) => {
    const files = imageFilesFromList(event.dataTransfer?.files);
    if (files.length === 0) return false;
    event.preventDefault();
    handleFilesRef.current(files);
    return true;
  }, []);

  const pickAndUpload = React.useCallback((fileList: FileList | null) => {
    handleFilesRef.current(imageFilesFromList(fileList));
  }, []);

  /**
   * Deferred mode: upload every pending image against the now-known task,
   * patch the successfully-uploaded nodes in the live editor, drop the failed
   * ones, and return counts + the final description JSON to persist.
   */
  async function flushPending(
    taskId: string,
  ): Promise<{ total: number; uploaded: number; failed: number; doc: unknown }> {
    const entries = [...pendingRef.current.entries()];
    let uploaded = 0;
    let failed = 0;
    setUploadCount((n) => n + entries.length);
    try {
      await Promise.all(
        entries.map(async ([tempId, file]) => {
          const up = await uploadOne(taskId, file).catch(() => null);
          if (up) {
            uploaded++;
            patchNode(tempId, {
              attachmentId: up.attachmentId,
              fileKey: up.fileKey,
              uploading: false,
              previewSrc: null,
            });
          } else {
            failed++;
            patchNode(tempId, null); // drop the failed placeholder
          }
        }),
      );
    } finally {
      setUploadCount((n) => Math.max(0, n - entries.length));
      pendingRef.current.clear();
    }
    const editor = editorRef.current;
    const doc = editor && !editor.isDestroyed ? editor.getJSON() : null;
    return { total: entries.length, uploaded, failed, doc };
  }

  const hasPending = () => pendingRef.current.size > 0;

  // Clear pending (deferred) state — call when a reused composer resets (e.g.
  // the create modal reopening) so stale files aren't uploaded later.
  const reset = React.useCallback(() => {
    pendingRef.current.clear();
    setUploadCount(0);
  }, []);

  return {
    setEditor,
    handlePaste,
    handleDrop,
    pickAndUpload,
    flushPending,
    hasPending,
    reset,
    uploading: uploadCount > 0,
  };
}
