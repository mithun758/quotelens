"use client";

// AI Elements Prompt Input, restyled: a multi-line textarea with a send button. Enter
// sends; Shift+Enter starts a new line.
import { ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export function PromptInput({ onSubmit, disabled, placeholder, className }: { onSubmit: (text: string) => void; disabled: boolean; placeholder: string; className?: string }) {
  const [text, setText] = useState("");
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (disabled || !text.trim()) return;
    onSubmit(text);
    setText("");
  };
  return (
    <form onSubmit={send} className={cn("rounded-xs border border-slate bg-sheet focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink", className)}>
      <label htmlFor="lens-question" className="sr-only">
        Ask Lens
      </label>
      <textarea
        id="lens-question"
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) send(e);
        }}
        className="no-focus-ring block max-h-40 min-h-12 w-full resize-none bg-transparent px-3 pt-2 text-body text-ink outline-none placeholder:text-slate"
      />
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="pl-1 text-meta text-slate">Enter to send, Shift+Enter for a new line</span>
        <Button type="submit" variant="primary" size="icon-sm" disabled={disabled || !text.trim()} aria-label="Send">
          <ArrowUp aria-hidden />
        </Button>
      </div>
    </form>
  );
}
