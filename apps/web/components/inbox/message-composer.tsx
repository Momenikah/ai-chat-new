"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Paperclip, SendHorizontal, Sparkles, Zap } from "lucide-react";
import type { QuickReply } from "@aichat/shared";
import { Button } from "@/components/ui/button";

export interface MessageComposerHandle {
  focus: () => void;
}

export const MessageComposer = forwardRef<
  MessageComposerHandle,
  {
    onSend: (body: string) => void;
    onTyping?: () => void;
    disabled?: boolean;
    quickReplies?: QuickReply[];
    /** When provided, shows an AI suggest button. Should resolve to a draft reply string. */
    onSuggestReply?: () => Promise<string>;
  }
>(function MessageComposer(
  { onSend, onTyping, disabled, quickReplies, onSuggestReply },
  ref,
) {
  const [value, setValue] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  }, [value]);

  function emitTyping() {
    if (!onTyping) return;
    if (typingDebounce.current) clearTimeout(typingDebounce.current);
    typingDebounce.current = setTimeout(() => onTyping(), 250);
  }

  function send() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function insertQuickReply(body: string) {
    setValue((prev) => (prev ? prev.trimEnd() + "\n" + body : body));
    setDrawerOpen(false);
    textareaRef.current?.focus();
  }

  async function handleSuggest() {
    if (!onSuggestReply || suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const draft = await onSuggestReply();
      const clean = draft.trim();
      if (clean) {
        setValue(clean);
        textareaRef.current?.focus();
      } else {
        setSuggestError("AI tidak memberi saran balasan.");
      }
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "Gagal mengambil saran AI");
    } finally {
      setSuggesting(false);
    }
  }

  // Resolve "/shortcut" typed in the composer.
  function resolveShortcutOnSpace(next: string) {
    if (!quickReplies || quickReplies.length === 0) return next;
    const m = next.match(/(^|\s)\/([a-zA-Z0-9_-]+)\s$/);
    if (!m) return next;
    const shortcut = m[2].toLowerCase();
    const match = quickReplies.find(
      (q) => q.shortcut.toLowerCase() === shortcut,
    );
    if (!match) return next;
    return next.slice(0, m.index ?? 0) + (m[1] || "") + match.body + " ";
  }

  return (
    <div className="relative border-t border-border bg-white p-3">
      {suggestError && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {suggestError}
        </p>
      )}

      <AnimatePresence>
        {drawerOpen && quickReplies && quickReplies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full left-3 right-3 mb-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-lg"
          >
            {quickReplies.map((q) => (
              <button
                key={q.id}
                onClick={() => insertQuickReply(q.body)}
                className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm transition-colors hover:bg-zinc-50"
              >
                <span className="inline-flex shrink-0 items-center rounded-md bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-white">
                  /{q.shortcut}
                </span>
                <p className="line-clamp-2 flex-1 text-xs text-zinc-700">
                  {q.body}
                </p>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 rounded-xl border border-border bg-white p-2 transition-colors focus-within:border-zinc-300">
        <button
          type="button"
          aria-label="Lampirkan file (segera hadir)"
          disabled
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-zinc-100 disabled:opacity-40"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {quickReplies && quickReplies.length > 0 && (
          <button
            type="button"
            aria-label="Quick reply"
            onClick={() => setDrawerOpen((s) => !s)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              drawerOpen
                ? "bg-zinc-900 text-white"
                : "text-muted-foreground hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <Zap className="h-4 w-4" />
          </button>
        )}

        {onSuggestReply && (
          <button
            type="button"
            aria-label="Saran balasan dari AI"
            title="Saran balasan dari AI"
            onClick={handleSuggest}
            disabled={disabled || suggesting}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 px-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {suggesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {suggesting ? "Menyusun…" : "Saran AI"}
            </span>
          </button>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const next = resolveShortcutOnSpace(e.target.value);
            setValue(next);
            emitTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            disabled ? "Pilih percakapan dulu" : "Tulis balasan… (Enter untuk kirim · ketik /shortcut)"
          }
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-snug outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        <Button
          size="icon"
          onClick={send}
          disabled={disabled || value.trim().length === 0}
          className="h-8 w-8 shrink-0"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});
