// Shared Tiptap Link options so every rich-text editor (task description,
// comment composer, comment renderer) linkifies URLs consistently.
//
// - autolink: turns a URL into a link as you type
// - linkOnPaste: pasting a URL (YouTube, Loom, any link) becomes a clickable link
// - openOnClick + target _blank: clicking opens it in a new tab (keeps the editor)
export const LINK_OPTIONS = {
  openOnClick: true,
  autolink: true,
  linkOnPaste: true,
  HTMLAttributes: {
    class: "text-primary underline underline-offset-2 cursor-pointer",
    rel: "noopener noreferrer nofollow",
    target: "_blank",
  },
} as const;
