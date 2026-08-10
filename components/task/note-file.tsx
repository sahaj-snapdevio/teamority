"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  DownloadSimpleIcon,
  FileDocIcon,
  FileIcon,
  FilePdfIcon,
  FilePptIcon,
  FileXlsIcon,
  FileZipIcon,
  SpinnerGapIcon,
  XIcon,
} from "@phosphor-icons/react";
import { mergeAttributes, Node } from "@tiptap/core";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useAttachmentPreview } from "@/components/task/attachment-preview-modal";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";

// Storage key → auth-gated serving URL (same route as images).
function noteFileUrl(key: string): string {
  return `/api/files/${key}`;
}

/** Pick an icon + tint for a file chip based on its MIME type / name. */
function iconForFile(
  mimeType: string | null,
  fileName: string | null
): {
  Icon: Icon;
  className: string;
} {
  const type = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return { Icon: FilePdfIcon, className: "text-red-500" };
  }
  if (type.includes("word") || /\.(docx?|rtf|odt)$/.test(name)) {
    return { Icon: FileDocIcon, className: "text-blue-500" };
  }
  if (
    type.includes("sheet") ||
    type.includes("excel") ||
    type === "text/csv" ||
    /\.(xlsx?|csv|ods)$/.test(name)
  ) {
    return { Icon: FileXlsIcon, className: "text-green-600" };
  }
  if (
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    /\.(pptx?|odp)$/.test(name)
  ) {
    return { Icon: FilePptIcon, className: "text-orange-500" };
  }
  if (type.includes("zip") || /\.(zip|rar|7z|tar|gz)$/.test(name)) {
    return { Icon: FileZipIcon, className: "text-amber-500" };
  }
  return { Icon: FileIcon, className: "text-base-content/60" };
}

interface NoteFileAttrs {
  attachmentId: string | null; // taskAttachment id, or a temp id while uploading
  fileKey: string | null; // storage key (persisted); null while uploading
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploading: boolean; // transient (client-only)
}

function NoteFileView({ node, selected, editor, deleteNode }: NodeViewProps) {
  const preview = useAttachmentPreview();
  const { fileKey, attachmentId, fileName, fileSize, mimeType, uploading } =
    node.attrs as NoteFileAttrs;
  const editable = editor.isEditable;
  const { Icon: FileTypeIcon, className: iconClass } = iconForFile(
    mimeType,
    fileName
  );
  const ready = !!fileKey && !uploading;

  function openPreview() {
    if (!fileKey) {
      return;
    }
    const url = noteFileUrl(fileKey);
    if (preview) {
      preview.open({
        id: attachmentId ?? fileKey,
        fileName: fileName ?? "Attachment",
        mimeType: mimeType ?? "application/octet-stream",
        url,
      });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <NodeViewWrapper className="note-file my-2" data-drag-handle>
      {/* The nested "remove attachment" button (below) means this can't just
          become a <button> — a button can't be a valid child of a button. */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: role="button" + tabIndex/onKeyDown make this element keyboard-interactive; a nested <button> below rules out converting the wrapper itself to <button> */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: role="button" + tabIndex/onKeyDown make this element keyboard-interactive; a nested <button> below rules out converting the wrapper itself to <button> */}
      <div
        className={cn(
          "group relative flex max-w-sm items-center gap-3 rounded-lg border bg-base-200/30 px-3 py-2 transition-colors",
          ready && "cursor-pointer hover:bg-base-200",
          selected && "ring-2 ring-primary"
        )}
        onClick={ready ? openPreview : undefined}
        onKeyDown={
          ready
            ? (e) => {
                if (e.target !== e.currentTarget) {
                  return;
                }
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openPreview();
                }
              }
            : undefined
        }
        role={ready ? "button" : undefined}
        tabIndex={ready ? 0 : undefined}
      >
        {uploading ? (
          <SpinnerGapIcon className="size-6 shrink-0 animate-spin text-base-content/60" />
        ) : (
          <FileTypeIcon
            className={cn("size-7 shrink-0", iconClass)}
            weight="fill"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-base-content">
            {fileName ?? "Attachment"}
          </p>
          <p className="text-xs text-base-content/60">
            {uploading ? "Uploading…" : formatBytes(fileSize)}
          </p>
        </div>
        {ready && (
          <DownloadSimpleIcon className="size-4 shrink-0 text-base-content/60 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
        {editable && !uploading && (
          <button
            className="absolute -right-2 -top-2 z-10 hidden size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 group-hover:flex"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            title="Remove attachment"
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Custom Tiptap node for a non-image file attachment (PDF, DOC, etc.) embedded
 * inline in a task description. Sibling of `noteImage` (components/task/
 * note-image.tsx) — same storage-key + upload-placeholder model, but rendered as
 * a downloadable file chip instead of an image. `uploading` is a transient
 * client-only attr for the optimistic placeholder while the upload is in flight.
 */
export const NoteFile = Node.create({
  name: "noteFile",
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
      fileName: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-file-name"),
        renderHTML: (attrs) =>
          attrs.fileName ? { "data-file-name": attrs.fileName } : {},
      },
      fileSize: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-file-size");
          return raw ? Number(raw) : null;
        },
        renderHTML: (attrs) =>
          attrs.fileSize == null
            ? {}
            : { "data-file-size": String(attrs.fileSize) },
      },
      mimeType: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-mime-type"),
        renderHTML: (attrs) =>
          attrs.mimeType ? { "data-mime-type": attrs.mimeType } : {},
      },
      // Transient — not serialized to HTML; cleared once upload completes.
      uploading: { default: false, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-note-file]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const key = HTMLAttributes["data-file-key"];
    const name = HTMLAttributes["data-file-name"] ?? "Attachment";
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-note-file": "",
        ...(key ? { href: noteFileUrl(key as string) } : {}),
      }),
      name as string,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteFileView);
  },
});
