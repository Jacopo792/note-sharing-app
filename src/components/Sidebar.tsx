import {
  ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus,
  GripVertical, Plus, Tag, Trash2, X, Check,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { AppSession } from "@/lib/session";
import { type Meta, type Tag as TagType, type Folder as FolderType, TAG_COLORS, EMPTY_META } from "@/lib/types";
import { TagBadge } from "./TagBadge";
import { useIsDark } from "@/lib/theme";

export interface NoteEntry {
  note: { id: string; title: string; body: string; owner: "u1" | "u2"; createdAt: string; updatedAt: string };
  sha: string;
  path: string;
}

interface Props {
  entries: NoteEntry[];
  meta: Meta;
  selectedId: string | null;
  filterTagIds: string[];
  session: AppSession;
  viewAs: "u1" | "u2";
  loading: boolean;
  saving: boolean;
  onSelect: (id: string) => void;
  onNew: (folderId?: string | null) => void;
  onDelete: (entry: NoteEntry) => void;
  onMetaChange: (meta: Meta) => void;
  onViewChange: (v: "u1" | "u2") => void;
  onFilterTagsChange: (ids: string[]) => void;
}

// ── Draggable note card ────────────────────────────────────────────────────

function DraggableNote({
  entry, selected, meta, onClick, onDelete,
}: {
  entry: NoteEntry; selected: boolean; meta: Meta;
  onClick: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.note.id });
  const nm = meta.notes.find((n) => n.id === entry.note.id);
  const tags = (nm?.tagIds ?? [])
    .map((tid) => meta.tags.find((t) => t.id === tid))
    .filter(Boolean) as TagType[];

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1, transition: "opacity 0.15s" }}
      onClick={onClick}
      className={`group relative px-3 py-2.5 cursor-pointer border-b border-border transition-colors ${
        selected ? "bg-selected" : "hover:bg-surface"
      }`}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 text-muted/30 hover:text-muted cursor-grab active:cursor-grabbing shrink-0 touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-foreground">
            {entry.note.title || "Untitled"}
          </p>
          <p className="text-xs text-muted truncate mt-0.5">
            {entry.note.body ? entry.note.body.replace(/[#*`>_]/g, "").slice(0, 60) : "No content"}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.map((t) => <TagBadge key={t.id} tag={t} size="xs" />)}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 mt-0.5 text-muted/0 group-hover:text-muted hover:text-danger transition-colors cursor-pointer"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Droppable folder section ───────────────────────────────────────────────

function DroppableSection({
  id, label, count, icon, isOpen, onToggle,
  onNew, onRename, onDeleteFolder, children,
}: {
  id: string; label: string; count: number;
  icon: React.ReactNode; isOpen: boolean;
  onToggle: () => void; onNew: () => void;
  onRename?: (name: string) => void;
  onDeleteFolder?: () => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  function commitRename() {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== label) onRename?.(trimmed);
    else setEditVal(label);
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${isOver ? "bg-accent/8 ring-1 ring-inset ring-accent/25 rounded-lg mx-1" : ""}`}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 group/folder">
        <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer">
          <span className="text-muted shrink-0">
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="text-muted shrink-0">{isOpen ? <FolderOpen size={13} /> : <Folder size={13} />}</span>
          {editing ? (
            <input
              ref={inputRef}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditVal(label); setEditing(false); } }}
              className="flex-1 min-w-0 text-xs font-medium bg-transparent outline-none border-b border-accent"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-xs font-medium text-foreground truncate flex-1"
              onDoubleClick={() => { if (onRename) { setEditing(true); setTimeout(() => inputRef.current?.select(), 0); } }}
            >
              {label}
            </span>
          )}
          {count > 0 && (
            <span className="text-[10px] text-muted bg-border rounded-full px-1.5 py-0.5 shrink-0">{count}</span>
          )}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
          <button onClick={onNew} title="New note here" className="text-muted hover:text-accent p-0.5 rounded cursor-pointer transition-colors">
            <Plus size={11} />
          </button>
          {onDeleteFolder && (
            <button onClick={onDeleteFolder} title="Delete folder" className="text-muted hover:text-danger p-0.5 rounded cursor-pointer transition-colors">
              <X size={11} />
            </button>
          )}
        </div>
      </div>
      {isOpen && <div>{children}</div>}
    </div>
  );
}

// ── Tag manager ─────────────────────────────────────────────────────────────

function TagManager({ meta, onMetaChange }: { meta: Meta; onMetaChange: (m: Meta) => void }) {
  const isDark = useIsDark();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<typeof TAG_COLORS[number]["id"]>("blue");
  const [open, setOpen] = useState(false);

  function addTag() {
    const name = newName.trim();
    if (!name) return;
    const tag: TagType = { id: crypto.randomUUID(), name, color: newColor };
    onMetaChange({ ...meta, tags: [...meta.tags, tag] });
    setNewName("");
  }

  function deleteTag(id: string) {
    onMetaChange({
      ...meta,
      tags: meta.tags.filter((t) => t.id !== id),
      notes: meta.notes.map((n) => ({ ...n, tagIds: n.tagIds.filter((t) => t !== id) })),
    });
  }

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        <Tag size={12} />
        <span className="font-medium">Tags</span>
        {meta.tags.length > 0 && (
          <span className="ml-auto text-[10px] bg-border text-muted rounded-full px-1.5 py-0.5">{meta.tags.length}</span>
        )}
        <ChevronDown size={11} className={`ml-auto transition-transform ${open ? "rotate-180" : ""} ${meta.tags.length > 0 ? "ml-0" : ""}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 animate-slide-up">
          {meta.tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 py-1">
              <TagBadge tag={tag} size="xs" />
              <button
                onClick={() => deleteTag(tag.id)}
                className="ml-auto text-muted/50 hover:text-danger transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-1.5 mt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Tag name…"
              className="flex-1 min-w-0 text-xs bg-surface border border-border rounded-md px-2 py-1 outline-none focus:border-accent transition-colors"
            />
            <div className="flex gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNewColor(c.id)}
                  title={c.id}
                  className="w-4 h-4 rounded-full cursor-pointer border-2 transition-all"
                  style={{
                    background: isDark ? c.darkBg : c.bg,
                    borderColor: newColor === c.id ? (isDark ? c.darkFg : c.fg) : "transparent",
                  }}
                />
              ))}
            </div>
            <button
              onClick={addTag}
              disabled={!newName.trim()}
              className="text-accent disabled:opacity-30 cursor-pointer transition-opacity"
            >
              <Check size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main sidebar ─────────────────────────────────────────────────────────

export function Sidebar({
  entries, meta, selectedId, filterTagIds, session, viewAs,
  loading, saving, onSelect, onNew, onDelete, onMetaChange, onViewChange, onFilterTagsChange,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const newFolderRef = useRef<HTMLInputElement>(null);

  const partnerName = meta.partnerName ?? "Partner";

  // Group entries by folder (applying tag filter)
  const { grouped, unfiled } = useMemo(() => {
    const grouped: Record<string, NoteEntry[]> = {};
    const unfiled: NoteEntry[] = [];
    for (const e of entries) {
      const nm = meta.notes.find((n) => n.id === e.note.id);
      if (filterTagIds.length > 0 && !filterTagIds.some((t) => nm?.tagIds.includes(t))) continue;
      const fid = nm?.folderId ?? null;
      if (fid && meta.folders.find((f) => f.id === fid)) {
        grouped[fid] = [...(grouped[fid] ?? []), e];
      } else {
        unfiled.push(e);
      }
    }
    return { grouped, unfiled };
  }, [entries, meta, filterTagIds]);

  const totalVisible = unfiled.length + Object.values(grouped).reduce((s, a) => s + a.length, 0);

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    setOverId(e.over?.id as string ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    setOverId(null);
    const { active, over } = e;
    if (!over) return;
    const noteId = active.id as string;
    const targetFolderId = over.id === "__unfiled" ? null : (over.id as string);
    const existing = meta.notes.find((n) => n.id === noteId);
    const updatedNotes = existing
      ? meta.notes.map((n) => n.id === noteId ? { ...n, folderId: targetFolderId } : n)
      : [...meta.notes, { id: noteId, folderId: targetFolderId, tagIds: [] }];
    onMetaChange({ ...meta, notes: updatedNotes });
  }

  function toggleFolder(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const folder: FolderType = { id: crypto.randomUUID(), name };
    onMetaChange({ ...meta, folders: [...meta.folders, folder] });
    setNewFolderName("");
    setShowNewFolder(false);
  }

  function renameFolder(id: string, name: string) {
    onMetaChange({ ...meta, folders: meta.folders.map((f) => f.id === id ? { ...f, name } : f) });
  }

  function deleteFolder(id: string) {
    onMetaChange({
      ...meta,
      folders: meta.folders.filter((f) => f.id !== id),
      notes: meta.notes.map((n) => n.folderId === id ? { ...n, folderId: null } : n),
    });
  }

  function toggleTagFilter(tid: string) {
    onFilterTagsChange(
      filterTagIds.includes(tid) ? filterTagIds.filter((t) => t !== tid) : [...filterTagIds, tid],
    );
  }

  const activeDragEntry = activeDragId ? entries.find((e) => e.note.id === activeDragId) : null;

  return (
    <aside className="w-64 border-r border-border flex flex-col bg-surface shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        {session.role === "u1" ? (
          <select
            value={viewAs}
            onChange={(e) => onViewChange(e.target.value as "u1" | "u2")}
            className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted bg-transparent outline-none cursor-pointer appearance-none"
          >
            <option value="u1">My Notes</option>
            <option value="u2">{partnerName}&apos;s Notes</option>
          </select>
        ) : (
          <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted">
            My Notes
          </span>
        )}
        <button
          onClick={() => onNew(null)}
          disabled={saving || loading}
          title="New note"
          className="text-accent hover:opacity-70 disabled:opacity-30 transition-opacity cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tag filter chips */}
      {meta.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border shrink-0">
          {meta.tags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              size="xs"
              onClick={() => toggleTagFilter(tag.id)}
              active={filterTagIds.length === 0 || filterTagIds.includes(tag.id)}
            />
          ))}
          {filterTagIds.length > 0 && (
            <button
              onClick={() => onFilterTagsChange([])}
              className="text-[10px] text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Note list with DnD */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 flex flex-col items-center gap-2">
              <span className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin inline-block" />
              <p className="text-xs text-muted">Loading…</p>
            </div>
          ) : totalVisible === 0 && !loading ? (
            <p className="px-4 py-6 text-xs text-muted text-center">No notes yet</p>
          ) : (
            <>
              {/* Unfiled */}
              <DroppableSection
                id="__unfiled"
                label="No Folder"
                count={unfiled.length}
                icon={<Folder size={13} />}
                isOpen={!collapsed.has("__unfiled")}
                onToggle={() => toggleFolder("__unfiled")}
                onNew={() => onNew(null)}
              >
                {unfiled.map((e) => (
                  <DraggableNote
                    key={e.note.id}
                    entry={e}
                    selected={selectedId === e.note.id}
                    meta={meta}
                    onClick={() => onSelect(e.note.id)}
                    onDelete={() => onDelete(e)}
                  />
                ))}
              </DroppableSection>

              {/* Folders */}
              {meta.folders.map((folder) => (
                <DroppableSection
                  key={folder.id}
                  id={folder.id}
                  label={folder.name}
                  count={grouped[folder.id]?.length ?? 0}
                  icon={<Folder size={13} />}
                  isOpen={!collapsed.has(folder.id)}
                  onToggle={() => toggleFolder(folder.id)}
                  onNew={() => onNew(folder.id)}
                  onRename={(name) => renameFolder(folder.id, name)}
                  onDeleteFolder={() => deleteFolder(folder.id)}
                >
                  {(grouped[folder.id] ?? []).map((e) => (
                    <DraggableNote
                      key={e.note.id}
                      entry={e}
                      selected={selectedId === e.note.id}
                      meta={meta}
                      onClick={() => onSelect(e.note.id)}
                      onDelete={() => onDelete(e)}
                    />
                  ))}
                </DroppableSection>
              ))}
            </>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragEntry ? (
            <div className="bg-raised border border-border rounded-lg shadow-lg px-3 py-2 w-56 opacity-90">
              <p className="text-xs font-medium text-foreground truncate">
                {activeDragEntry.note.title || "Untitled"}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Footer: new folder + tag manager */}
      <div className="shrink-0 border-t border-border">
        {showNewFolder ? (
          <div className="flex items-center gap-1.5 px-3 py-2 animate-slide-up">
            <Folder size={12} className="text-muted shrink-0" />
            <input
              ref={newFolderRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addFolder();
                if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
              }}
              onBlur={() => { if (!newFolderName.trim()) setShowNewFolder(false); }}
              placeholder="Folder name…"
              autoFocus
              className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b border-accent"
            />
            <button onClick={addFolder} className="text-accent cursor-pointer" disabled={!newFolderName.trim()}>
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowNewFolder(true); setTimeout(() => newFolderRef.current?.focus(), 0); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <FolderPlus size={12} />
            <span>New folder</span>
          </button>
        )}

        <TagManager meta={meta} onMetaChange={onMetaChange} />
      </div>
    </aside>
  );
}
