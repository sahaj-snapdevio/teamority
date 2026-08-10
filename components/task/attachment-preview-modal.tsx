"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  DownloadSimpleIcon,
  FileIcon,
  FilePdfIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PreviewAttachment {
  fileName: string;
  fileSize?: number;
  id: string;
  mimeType: string;
  url: string;
}

interface AttachmentPreviewContextValue {
  open: (attachment: PreviewAttachment) => void;
}

const AttachmentPreviewContext =
  React.createContext<AttachmentPreviewContextValue | null>(null);

/**
 * Opens attachments in an in-app preview modal. Returns `null` when no provider
 * is present so callers can fall back to opening the file in a new tab.
 */
export function useAttachmentPreview() {
  return React.useContext(AttachmentPreviewContext);
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AttachmentPreviewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [current, setCurrent] = React.useState<PreviewAttachment | null>(null);
  const open = React.useCallback(
    (attachment: PreviewAttachment) => setCurrent(attachment),
    []
  );
  const value = React.useMemo(() => ({ open }), [open]);

  return (
    <AttachmentPreviewContext.Provider value={value}>
      {children}
      <AttachmentPreviewModal
        attachment={current}
        onOpenChange={(o) => {
          if (!o) {
            setCurrent(null);
          }
        }}
      />
    </AttachmentPreviewContext.Provider>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function formatBytes(bytes?: number) {
  if (bytes === undefined) {
    return null;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Modal ──────────────────────────────────────────────────────────────────

function AttachmentPreviewModal({
  attachment,
  onOpenChange,
}: {
  attachment: PreviewAttachment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoom, setZoom] = React.useState(1);
  // Pan offset (px) so a zoomed image can be dragged to reveal every edge —
  // CSS `scale` alone doesn't grow layout size, so an overflow container can't
  // scroll to the clipped parts; we translate the image instead.
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragStart = React.useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Reset zoom + pan whenever a different attachment is opened.
  React.useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const mime = attachment?.mimeType ?? "";
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

  // When zoom drops back to fit, recenter so the image never gets stranded.
  const clampAfterZoom = React.useCallback((next: number) => {
    if (next <= 1) {
      setOffset({ x: 0, y: 0 });
    }
    return next;
  }, []);
  const zoomIn = () =>
    setZoom((z) =>
      clampAfterZoom(Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
    );
  const zoomOut = () =>
    setZoom((z) =>
      clampAfterZoom(Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
    );
  const zoomReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Wheel to zoom (non-passive so we can prevent the page/scroll default).
  React.useEffect(() => {
    const el = bodyRef.current;
    if (!el || !isImage) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      setZoom((z) =>
        clampAfterZoom(
          Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, +(z + dir * ZOOM_STEP).toFixed(2))
          )
        )
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isImage, clampAfterZoom]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) {
      return;
    }
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) {
      return;
    }
    setDragging(false);
    dragStart.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already be released
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={attachment !== null}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "h-[90vh] w-[95vw] max-w-275 sm:max-w-275",
          "rounded-xl"
        )}
        showCloseButton={false}
      >
        {attachment && (
          <TooltipProvider delayDuration={300}>
            {/* Header / toolbar */}
            <div className="flex items-center gap-3 border-b bg-elevated px-4 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {isPdf ? (
                  <FilePdfIcon className="size-4 shrink-0 text-red-500" />
                ) : (
                  <FileIcon className="size-4 shrink-0 text-base-content/60" />
                )}
                <DialogTitle className="truncate text-sm font-medium leading-none">
                  {attachment.fileName}
                </DialogTitle>
                {formatBytes(attachment.fileSize) && (
                  <span className="shrink-0 text-2xs text-base-content/60">
                    {formatBytes(attachment.fileSize)}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {isImage && (
                  <>
                    <ToolbarButton
                      disabled={zoom <= ZOOM_MIN}
                      label="Zoom out"
                      onClick={zoomOut}
                    >
                      <MagnifyingGlassMinusIcon className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton label="Reset zoom" onClick={zoomReset}>
                      <span className="text-2xs font-semibold tabular-nums">
                        {Math.round(zoom * 100)}%
                      </span>
                    </ToolbarButton>
                    <ToolbarButton
                      disabled={zoom >= ZOOM_MAX}
                      label="Zoom in"
                      onClick={zoomIn}
                    >
                      <MagnifyingGlassPlusIcon className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                      label="Reset zoom (100%)"
                      onClick={zoomReset}
                    >
                      <ArrowCounterClockwiseIcon className="size-4" />
                    </ToolbarButton>
                    <div className="mx-1 h-5 w-px bg-base-300" />
                  </>
                )}
                <ToolbarButton asChild label="Download">
                  <a download={attachment.fileName} href={attachment.url}>
                    <DownloadSimpleIcon className="size-4" />
                  </a>
                </ToolbarButton>
                <ToolbarButton asChild label="Open in new tab">
                  <a
                    href={attachment.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ArrowSquareOutIcon className="size-4" />
                  </a>
                </ToolbarButton>
                <div className="mx-1 h-5 w-px bg-base-300" />
                <ToolbarButton
                  label="Close"
                  onClick={() => onOpenChange(false)}
                >
                  <XIcon className="size-4" />
                </ToolbarButton>
              </div>
            </div>

            {/* Body */}
            <div
              className={cn(
                "relative flex-1 bg-base-200/40",
                isImage ? "select-none overflow-hidden" : "overflow-auto"
              )}
              onPointerDown={isImage ? onPointerDown : undefined}
              onPointerLeave={isImage ? endDrag : undefined}
              onPointerMove={isImage ? onPointerMove : undefined}
              onPointerUp={isImage ? endDrag : undefined}
              ref={bodyRef}
              style={
                isImage
                  ? {
                      cursor:
                        zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
                    }
                  : undefined
              }
            >
              {isImage ? (
                <div className="flex h-full w-full items-center justify-center p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {/* biome-ignore lint/performance/noImgElement: arbitrary user-uploaded attachment with unpredictable dimensions inside a custom zoom/pan viewer — next/image's fixed sizing doesn't fit this use case */}
                  <img
                    alt={attachment.fileName}
                    className={cn(
                      "max-h-full max-w-full origin-center object-contain",
                      !dragging && "transition-transform duration-150"
                    )}
                    draggable={false}
                    src={attachment.url}
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    }}
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  className="h-full w-full border-0 bg-white"
                  src={attachment.url}
                  title={attachment.fileName}
                />
              ) : isVideo ? (
                <div className="flex h-full w-full items-center justify-center p-6">
                  {/* biome-ignore lint/a11y/useMediaCaption: arbitrary user-uploaded attachment — no caption/transcript source is available to attach */}
                  <video
                    className="max-h-full max-w-full rounded-lg"
                    controls
                    src={attachment.url}
                  />
                </div>
              ) : isAudio ? (
                <div className="flex h-full w-full items-center justify-center p-6">
                  {/* biome-ignore lint/a11y/useMediaCaption: arbitrary user-uploaded attachment — no caption/transcript source is available to attach */}
                  <audio
                    className="w-full max-w-md"
                    controls
                    src={attachment.url}
                  />
                </div>
              ) : (
                <UnpreviewableState attachment={attachment} />
              )}
            </div>
          </TooltipProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Toolbar button ─────────────────────────────────────────────────────────

function ToolbarButton({
  label,
  children,
  asChild,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild={asChild}
          className="text-base-content/60 hover:text-base-content"
          size="icon-xs"
          variant="ghost"
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Unpreviewable fallback ───────────────────────────────────────────────────

function UnpreviewableState({ attachment }: { attachment: PreviewAttachment }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-base-200">
        <FileIcon className="size-8 text-base-content/60" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{attachment.fileName}</p>
        <p className="text-xs text-base-content/60">
          This file type can&apos;t be previewed here.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm">
          <a download={attachment.fileName} href={attachment.url}>
            <DownloadSimpleIcon className="size-4" />
            Download
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={attachment.url} rel="noopener noreferrer" target="_blank">
            <ArrowSquareOutIcon className="size-4" />
            Open in new tab
          </a>
        </Button>
      </div>
    </div>
  );
}
