import type { Editor, Range } from "@tiptap/core";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import type { MentionMember } from "@/app/actions/mention";
import { MentionList, type MentionListRef } from "./mention-list";

// Minimal local shape for the Tiptap `Suggestion` plugin's render-callback props —
// `@tiptap/suggestion` (the package that actually declares `SuggestionProps`) is
// only a transitive dependency of `@tiptap/extension-mention`, not resolvable
// from app code, so we mirror the subset of fields this file actually reads.
// `MentionNodeAttrs` (the `command` callback's item type) is imported directly
// since `@tiptap/extension-mention` is a direct dependency.
interface MentionSuggestionRenderProps {
  clientRect?: (() => DOMRect | null) | null;
  command: (item: MentionNodeAttrs) => void;
  editor: Editor;
  items: MentionMember[];
}

// Accepts a getter so the suggestion always reads the latest members list,
// even though the Tiptap extension is instantiated only once.
export function buildMentionSuggestion(
  getMembers: () => MentionMember[],
  onActiveChange?: (active: boolean) => void
) {
  return {
    char: "@",

    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return getMembers().filter(
        (m) =>
          m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      );
    },

    command: ({
      editor,
      range,
      props,
    }: {
      editor: Editor;
      range: Range;
      props: MentionNodeAttrs;
    }) => {
      const { id, label } = props;

      const mentionNodeType = editor.schema.nodes.mention;
      if (!mentionNodeType) {
        return;
      }

      const mentionNode = mentionNodeType.create({ id, label });
      const spaceNode = editor.schema.text(" ");

      // Dispatch a raw ProseMirror transaction — most direct path
      const tr = editor.view.state.tr;
      tr.replaceWith(range.from, range.to, [mentionNode, spaceNode]);
      editor.view.dispatch(tr);
    },

    render: () => {
      let renderer: ReactRenderer<MentionListRef>;
      let popup: TippyInstance[];

      return {
        onStart(props: MentionSuggestionRenderProps) {
          onActiveChange?.(true);
          renderer = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy("body" as unknown as Element, {
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
            appendTo: () => document.body,
            content: renderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            arrow: false,
            theme: "mention-popup",
          }) as unknown as TippyInstance[];
        },

        onUpdate(props: MentionSuggestionRenderProps) {
          renderer.updateProps(props);
          if (props.clientRect) {
            popup[0]?.setProps({
              getReferenceClientRect: () =>
                props.clientRect?.() ?? new DOMRect(),
            });
          }
        },

        onKeyDown({ event }: { event: KeyboardEvent }) {
          if (event.key === "Escape") {
            popup[0]?.hide();
            return true;
          }
          return renderer.ref?.onKeyDown(event) ?? false;
        },

        onExit() {
          onActiveChange?.(false);
          popup[0]?.destroy();
          renderer.destroy();
        },
      };
    },
  };
}
