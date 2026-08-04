"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error"

const AvatarContext = React.createContext<{
  status: ImageLoadingStatus
  setStatus: React.Dispatch<React.SetStateAction<ImageLoadingStatus>>
} | null>(null)

function useAvatarContext() {
  const context = React.useContext(AvatarContext)
  if (!context) {
    throw new Error("Avatar parts must be used within <Avatar>")
  }
  return context
}

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"span"> & {
  size?: "default" | "sm" | "lg"
}) {
  const [status, setStatus] = React.useState<ImageLoadingStatus>("idle")

  return (
    <AvatarContext.Provider value={{ status, setStatus }}>
      <span
        data-slot="avatar"
        data-size={size}
        className={cn(
          "avatar group/avatar flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  )
}

function AvatarImage({
  className,
  src,
  onLoad,
  onError,
  ...props
}: React.ComponentProps<"img">) {
  const { status, setStatus } = useAvatarContext()
  const imgRef = React.useRef<HTMLImageElement>(null)

  // useLayoutEffect (not useEffect) so this resolves before paint, and keyed
  // on [src] so it re-checks every time the same <img> DOM node is reused
  // with a new src (e.g. profile avatar-upload swaps existing → blob preview
  // → uploaded url on one mounted element). Checking `img.complete` matters
  // because the browser can resolve an image (cache hit, or a load/error
  // event that already fired before this effect re-runs) before we start
  // listening again — without this, `status` gets stuck at "loading" forever
  // and the fallback initials permanently cover an image that did load.
  React.useLayoutEffect(() => {
    if (!src) {
      setStatus("error")
      return
    }
    const img = imgRef.current
    if (img?.complete) {
      setStatus(img.naturalWidth > 0 ? "loaded" : "error")
    } else {
      setStatus("loading")
    }
  }, [src, setStatus])

  if (!src || status === "error") return null

  return (
    <img
      ref={imgRef}
      data-slot="avatar-image"
      src={src}
      className={cn(
        "absolute inset-0 z-10 aspect-square size-full rounded-full object-cover",
        className
      )}
      onLoad={(event) => {
        setStatus("loaded")
        onLoad?.(event)
      }}
      onError={(event) => {
        setStatus("error")
        onError?.(event)
      }}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const { status } = useAvatarContext()

  if (status === "loaded") return null

  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "absolute inset-0 flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-20 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
