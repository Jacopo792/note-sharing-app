import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Meta, Tag } from "@/lib/types";
import { TagBadge } from "./TagBadge";
import { useIsDark } from "@/lib/theme";

interface NoteEntry {
  note: { id: string; title: string; body: string; owner: "u1" | "u2" };
  sha: string;
  path: string;
}

interface Props {
  entry: NoteEntry | null;
  meta: Meta;
  draft: { title: string; body: string } | null;
  isDirty: boolean;
  canEdit: boolean;
  viewingAsPartner: boolean;
  onChange: (title: string, body: string) => void;
  onTagsChange: (noteId: string, tagIds: string[]) => void;
  onSave: () => void;
}

export function NoteEditor({
  entry, meta, draft, isDirty, canEdit, viewingAsPartner,
  onChange, onTagsChange, onSave,
}: Props) {
  const isDark = useIsDark();
  const [showTagPicker, setShowTagPicker] = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node))
        setShowTagPicker(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) onSave();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isDirty, onSave]);

  if (!entry || !draft) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted">Select or create a note</p>
      </div>
    );
  }

  const nm = meta.notes.find((n) => n.id === entry.note.id);
  const assignedTagIds = nm?.tagIds ?? [];
  const assignedTags = assignedTagIds.map((tid) => meta.tags.find((t) => t.id === tid)).filter(Boolean) as Tag[];
  const availableTags = meta.tags.filter((t) => !assignedTagIds.includes(t.id));

  function removeTag(tid: string) {
    onTagsChange(entry!.note.id, assignedTagIds.filter((t) => t !== tid));
  }

  function addTag(tid: string) {
    onTagsChange(entry!.note.id, [...assignedTagIds, tid]);
    setShowTagPicker(false);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
      {viewingAsPartner && (
        <div className="px-5 pt-4 pb-0 animate-fade-in">
          <span className="text-[10px] uppercase tracking-widest text-muted border border-border rounded-full px-2 py-0.5">
            {meta.partnerName ?? "Partner"}
          </span>
        </div>
      )}

      <div className="px-5 pt-5 pb-1">
        <input
          value={draft.title}
          onChange={(e) => canEdit && onChange(e.target.value, draft.body)}
          placeholder="Title"
          readOnly={!canEdit}
          className="w-full text-2xl font-semibold outline-none bg-transparent text-foreground placeholder:text-muted/40"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-5 pb-2">
        {assignedTags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} onRemove={canEdit ? () => removeTag(tag.id) : undefined} />
        ))}
        {canEdit && meta.tags.length > 0 && (
          <div className="relative" ref={tagPickerRef}>
            <button
              onClick={() => setShowTagPicker((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground border border-dashed border-border rounded-full px-2 py-0.5 transition-colors cursor-pointer"
            >
              <Plus size={10} />
              Add tag
            </button>
            {showTagPicker && availableTags.length > 0 && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-raised border border-border rounded-xl shadow-lg p-1.5 min-w-32 animate-scale-in">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => addTag(tag.id)}
                    className="flex items-center gap-2 w-full px-2 py-1 rounded-lg hover:bg-selected transition-colors cursor-pointer"
                  >
                    <TagBadge tag={tag} size="xs" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden border-t border-border" data-color-mode={isDark ? "dark" : "light"}>
        <MDEditor
          value={draft.body}
          onChange={(v) => canEdit && onChange(draft.title, v ?? "")}
          height="100%"
          preview="live"
          visibleDragbar={false}
          textareaProps={{ readOnly: !canEdit, placeholder: "Start writing in Markdown…" }}
        />
      </div>
    </div>
  );
}
