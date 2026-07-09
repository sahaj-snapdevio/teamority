// Shared helpers for rich-text bodies (comments, notes, task descriptions)
// stored as Tiptap JSON.

/**
 * Collect the taskAttachment ids of inline `noteImage` nodes embedded in a
 * Tiptap JSON body. Used to link images on create and reconcile (delete
 * removed) images on edit — in both comments and task descriptions.
 */
export function extractInlineImageAttachmentIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const ids: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "noteImage" && n.attrs && typeof n.attrs === "object") {
      const attrs = n.attrs as Record<string, unknown>;
      if (typeof attrs.attachmentId === "string") ids.push(attrs.attachmentId);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(body);
  return [...new Set(ids)];
}

/**
 * Whether a Tiptap JSON doc has any meaningful content — non-whitespace text
 * or an inline image node. Used to decide whether to persist a description.
 */
export function tiptapHasContent(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  let found = false;
  function walk(node: unknown) {
    if (found || !node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "noteImage") {
      found = true;
      return;
    }
    if (n.type === "text" && typeof n.text === "string" && n.text.trim() !== "") {
      found = true;
      return;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(body);
  return found;
}
