// Shared helpers for rich-text bodies (comments, notes, task descriptions)
// stored as Tiptap JSON.

/**
 * Normalize a body that may be a Tiptap JSON object OR a JSON string (task
 * descriptions are persisted as a stringified doc; comments as objects) into an
 * object. Returns null if it isn't parseable — callers treat that as "unknown"
 * (NOT "empty"), which matters for the image-reconciliation guard.
 */
export function toTiptapDoc(body: unknown): unknown {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
}

/**
 * Collect the taskAttachment ids of inline `noteImage` nodes embedded in a
 * Tiptap JSON body (object OR stringified). Used to link images on create and
 * reconcile (delete removed) images on edit — in comments and task descriptions.
 */
export function extractInlineImageAttachmentIds(body: unknown): string[] {
  body = toTiptapDoc(body);
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
 * Collect the user ids of @mention nodes in a Tiptap JSON body. Shared by the
 * comment and task-description mention-notification flows.
 */
export function extractMentionIds(body: unknown): string[] {
  body = toTiptapDoc(body);
  if (!body || typeof body !== "object") return [];
  const ids: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "mention" && n.attrs && typeof n.attrs === "object") {
      const attrs = n.attrs as Record<string, unknown>;
      if (typeof attrs.id === "string") ids.push(attrs.id);
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
  body = toTiptapDoc(body);
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
