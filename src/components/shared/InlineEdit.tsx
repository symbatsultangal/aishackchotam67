import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function InlineEdit({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (nextValue: string) => Promise<void> | void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const nextValue = draft.trim();
    if (!nextValue || nextValue === value) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setSaving(true);
    try {
      await onSave(nextValue);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={cn(
          "w-full rounded-md border border-brand-accent bg-white px-2 py-1 outline-none",
          saving && "animate-pulse",
          className,
        )}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className={cn("cursor-text text-left hover:text-brand-accent", className)}
      type="button"
      onClick={() => setEditing(true)}
    >
      {value}
    </button>
  );
}
