"use client";

import { SpinnerGapIcon, XIcon } from "@phosphor-icons/react";
import { mergeAttributes, Node } from "@tiptap/core";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useAttachmentPreview } from "@/components/task/attachment-preview-modal";
import { cn } from "@/lib/utils";

// A storage key → auth-gated serving URL (mirrors avatarSrc in lib/priority-config.ts).
export function noteImageUrl(key: string): string {
  return `/api/files/${key}`;
}

interface NoteImageAttrs {
  alt: string | null;
  attachmentId: string | null; // taskAttachment id, or a temp id while uploading
  fileKey: string | null; // storage key (persisted); null while uploading
  previewSrc: string | null; // transient objectURL shown while uploading
  uploading: boolean; // transient (client-only)
}

function NoteImageView({ node, selected, editor, deleteNode }: NodeViewProps) {
  const preview = useAttachmentPreview();
  const { fileKey, attachmentId, alt, uploading, previewSrc } =
    node.attrs as NoteImageAttrs;
  const editable = editor.isEditable;

  // Spinner only during an actual upload. A "pending" deferred image (create
  // modal, no upload yet) just shows its local preview.
  const isUploading = uploading;
  const src = fileKey ? noteImageUrl(fileKey) : (previewSrc ?? undefined);

  function openPreview() {
    if (!fileKey) {
      return;
    }
    const url = noteImageUrl(fileKey);
    if (preview) {
      preview.open({
        id: attachmentId ?? fileKey,
        fileName: alt ?? "image",
        mimeType: "image/*",
        url,
      });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <NodeViewWrapper className="note-image my-2" data-drag-handle>
      <div
        className={cn(
          "group relative inline-block max-w-full overflow-hidden rounded-lg border bg-muted/30",
          selected && "ring-2 ring-primary"
        )}
      >
        {/* Remove the image (editable composers only). Deleting from the body
            + saving cleans up its storage object via server reconciliation. */}
        {editable && (
          <button
            type="button"
            onClick={() => deleteNode()}
            title="Remove image"
            className="absolute right-1.5 top-1.5 z-10 hidden size-6 items-center justify-center rounded-md bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 group-hover:flex"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
        {src &&
          (fileKey ? (
            <button
              type="button"
              onClick={openPreview}
              className="block cursor-zoom-in"
            >
              {/* biome-ignore lint/performance/noImgElement: served from auth-gated /api/files storage keys; next/image can't optimize these */}
              <img
                alt={alt ?? ""}
                className="max-h-96 max-w-full object-contain"
                draggable={false}
                src={src}
              />
            </button>
          ) : (
            // Optimistic placeholder while uploading (not yet clickable)
            // biome-ignore lint/performance/noImgElement: transient local objectURL preview
            <img
              alt={alt ?? ""}
              className="max-h-96 max-w-full object-contain opacity-60"
              draggable={false}
              src={src}
            />
          ))}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <SpinnerGapIcon className="size-6 animate-spin text-foreground/70" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Custom Tiptap node for an inline image embedded in a comment/note body.
 * Persists the storage `fileKey` (rendered via /api/files/{key}); `uploading`
 * and `previewSrc` are transient client-only attrs used for the optimistic
 * placeholder while the paste/drop upload is in flight. Built on @tiptap/core
 * (no @tiptap/extension-image) because we need this custom NodeView anyway
 * (key-based src, upload placeholder, click-to-lightbox).
 */
export const NoteImage = Node.create({
  name: "noteImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      fileKey: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-file-key"),
        renderHTML: (attrs) =>
          attrs.fileKey ? { "data-file-key": attrs.fileKey } : {},
      },
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) =>
          attrs.attachmentId
            ? { "data-attachment-id": attrs.attachmentId }
            : {},
      },
      alt: {
        default: null,
        parseHTML: (el) => el.getAttribute("alt"),
        renderHTML: (attrs) => (attrs.alt ? { alt: attrs.alt } : {}),
      },
      // Transient — not serialized to HTML; cleared once upload completes.
      uploading: { default: false, rendered: false },
      previewSrc: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-file-key]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const key = HTMLAttributes["data-file-key"];
    return [
      "img",
      mergeAttributes(HTMLAttributes, key ? { src: noteImageUrl(key) } : {}),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView);
  },
});
