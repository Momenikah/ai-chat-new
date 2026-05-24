import { useEffect } from "react";

export interface InboxShortcuts {
  onNext?: () => void;
  onPrev?: () => void;
  onFocusComposer?: () => void;
  onFocusSearch?: () => void;
  onResolve?: () => void;
  onAssignSelf?: () => void;
  onToggleBulk?: () => void;
  onShowHelp?: () => void;
  onEscape?: () => void;
  /** When true, all handlers are no-ops. */
  disabled?: boolean;
}

/**
 * Global keydown listener for inbox shortcuts. Skips shortcuts when the user
 * is typing in an input/textarea/contenteditable (except for Escape, which
 * always fires). Modifier-pressed combos are ignored so browser shortcuts
 * (e.g. Ctrl+R reload) keep working.
 */
export function useInboxShortcuts(opts: InboxShortcuts) {
  useEffect(() => {
    if (opts.disabled) return;

    function handler(e: KeyboardEvent) {
      // Always honor Escape, even inside fields.
      if (e.key === "Escape") {
        opts.onEscape?.();
        return;
      }

      // Skip when typing in form controls or modifier combos.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;
      if (isField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          opts.onNext?.();
          break;
        case "k":
          e.preventDefault();
          opts.onPrev?.();
          break;
        case "r":
          e.preventDefault();
          opts.onFocusComposer?.();
          break;
        case "e":
          e.preventDefault();
          opts.onResolve?.();
          break;
        case "a":
          e.preventDefault();
          opts.onAssignSelf?.();
          break;
        case "b":
          e.preventDefault();
          opts.onToggleBulk?.();
          break;
        case "/":
          e.preventDefault();
          opts.onFocusSearch?.();
          break;
        case "?":
          e.preventDefault();
          opts.onShowHelp?.();
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [opts]);
}

export const SHORTCUT_HELP: { keys: string; label: string }[] = [
  { keys: "j / k", label: "Percakapan berikutnya / sebelumnya" },
  { keys: "r", label: "Fokus ke kotak balasan" },
  { keys: "e", label: "Tandai resolved" },
  { keys: "a", label: "Assign ke saya" },
  { keys: "b", label: "Toggle bulk-select mode" },
  { keys: "/", label: "Fokus pencarian" },
  { keys: "?", label: "Tampilkan bantuan ini" },
  { keys: "Esc", label: "Tutup overlay / keluar bulk mode" },
];
