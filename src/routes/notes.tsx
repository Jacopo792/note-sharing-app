import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudUpload, Lock, Save } from "lucide-react";
import { restoreSession, clearSession, type AppSession } from "@/lib/session";
import { decryptFile, encryptNote } from "@/lib/crypto";
import { fetchNoteFiles, writeNoteFile, deleteNoteFile, ensureDataBranch } from "@/lib/github";
import { loadMeta, saveMeta } from "@/lib/meta";
import { type Meta, type NoteMeta, type Note, EMPTY_META } from "@/lib/types";
import { lazy, Suspense } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SaveModal } from "@/components/SaveModal";
import { Sidebar, type NoteEntry } from "@/components/Sidebar";

const NoteEditor = lazy(() =>
  import("@/components/NoteEditor").then((m) => ({ default: m.NoteEditor })),
);

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

function NotesPage() {
  const navigate = useNavigate();

  // ── Session ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState<AppSession | null>(null);

  // ── View (u1 can see own notes or partner's notes) ───────────────────────
  const [viewAs, setViewAs] = useState<"u1" | "u2">("u1");

  // ── Notes data ───────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Per-view meta (folders, tags, note assignments) ──────────────────────
  const [myMeta, setMyMeta] = useState<Meta>({ ...EMPTY_META });
  const [myMetaSha, setMyMetaSha] = useState<string | undefined>();
  const [partnerMeta, setPartnerMeta] = useState<Meta>({ ...EMPTY_META });
  const [partnerMetaSha, setPartnerMetaSha] = useState<string | undefined>();

  const activeMeta = viewAs === "u1" ? myMeta : partnerMeta;
  const activeMetaSha = viewAs === "u1" ? myMetaSha : partnerMetaSha;

  function setActiveMeta(m: Meta) {
    if (viewAs === "u1") setMyMeta(m); else setPartnerMeta(m);
  }
  function setActiveMetaSha(sha: string) {
    if (viewAs === "u1") setMyMetaSha(sha); else setPartnerMetaSha(sha);
  }

  // ── Draft (local, not pushed) ────────────────────────────────────────────
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isMetaDirty, setIsMetaDirty] = useState(false);
  const lastSelectedRef = useRef<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    restoreSession().then((s) => {
      if (!s) { navigate({ to: "/" }); return; }
      setSession(s);
    });
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    load(session);
  }, [session]);

  async function load(s: AppSession) {
    setLoading(true);
    setError("");
    try {
      await ensureDataBranch(s.repo, s.pat);

      const [files, myMetaResult, partnerMetaResult] = await Promise.all([
        fetchNoteFiles(s.repo, s.pat),
        loadMeta(s.repo, s.pat, s.keys, s.role),
        s.role === "u1" ? loadMeta(s.repo, s.pat, s.keys, "u2") : Promise.resolve({ meta: { ...EMPTY_META }, sha: undefined }),
      ]);

      const decrypted: NoteEntry[] = [];
      await Promise.all(
        files.map(async (f) => {
          const note = await decryptFile(f.content, s.keys);
          if (note) decrypted.push({ note, sha: f.sha, path: f.path });
        }),
      );
      decrypted.sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt));

      setEntries(decrypted);
      setMyMeta(myMetaResult.meta);
      setMyMetaSha(myMetaResult.sha);
      if (s.role === "u1") {
        setPartnerMeta(partnerMetaResult.meta);
        setPartnerMetaSha(partnerMetaResult.sha);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // ── Selection & draft ────────────────────────────────────────────────────
  const viewEntries = entries.filter((e) => e.note.owner === viewAs);
  const selected = viewEntries.find((e) => e.note.id === selectedId) ?? null;
  const canEdit = selected
    ? session?.role === "u1" || selected.note.owner === "u2"
    : false;

  useEffect(() => {
    if (selected && selected.note.id !== lastSelectedRef.current) {
      setDraft({ title: selected.note.title, body: selected.note.body });
      setIsDraftDirty(false);
      lastSelectedRef.current = selected.note.id;
    }
    if (!selected) { setDraft(null); setIsDraftDirty(false); }
  }, [selected]);

  function handleDraftChange(title: string, body: string) {
    setDraft({ title, body });
    setIsDraftDirty(true);
  }

  // ── Meta changes (from sidebar: folders, tags, assignments) ─────────────
  function handleMetaChange(m: Meta) {
    setActiveMeta(m);
    setIsMetaDirty(true);
  }

  function handleTagsChange(noteId: string, tagIds: string[]) {
    const existing = activeMeta.notes.find((n) => n.id === noteId);
    const updatedNotes: NoteMeta[] = existing
      ? activeMeta.notes.map((n) => n.id === noteId ? { ...n, tagIds } : n)
      : [...activeMeta.notes, { id: noteId, folderId: null, tagIds }];
    handleMetaChange({ ...activeMeta, notes: updatedNotes });
  }

  // ── New note ─────────────────────────────────────────────────────────────
  const handleNew = useCallback(
    async (folderId?: string | null) => {
      if (!session) return;
      const owner = viewAs;
      const note: Note = {
        id: crypto.randomUUID(), title: "", body: "",
        owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setSaving(true); setError("");
      try {
        const content = await encryptNote(note, session.keys);
        const path = `notes/${note.id}.napp`;
        const sha = await writeNoteFile(session.repo, session.pat, path, content);
        const newEntry: NoteEntry = { note, sha, path };
        setEntries((prev) => [newEntry, ...prev]);

        // Add to meta
        const newNoteMeta: NoteMeta = { id: note.id, folderId: folderId ?? null, tagIds: [] };
        const updatedMeta = { ...activeMeta, notes: [...activeMeta.notes, newNoteMeta] };
        setActiveMeta(updatedMeta);
        setIsMetaDirty(true);

        setSelectedId(note.id);
        setDraft({ title: "", body: "" });
        setIsDraftDirty(false);
        lastSelectedRef.current = note.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create note");
      } finally {
        setSaving(false);
      }
    },
    [session, viewAs, activeMeta],
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (entry: NoteEntry) => {
      if (!session) return;
      setSaving(true); setError("");
      try {
        await deleteNoteFile(session.repo, session.pat, entry.path, entry.sha);
        setEntries((prev) => prev.filter((e) => e.note.id !== entry.note.id));
        const updatedMeta = { ...activeMeta, notes: activeMeta.notes.filter((n) => n.id !== entry.note.id) };
        setActiveMeta(updatedMeta);
        setIsMetaDirty(true);
        if (selectedId === entry.note.id) { setSelectedId(null); setDraft(null); }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      } finally {
        setSaving(false);
      }
    },
    [session, selectedId, activeMeta],
  );

  // ── Save (push to GitHub) ────────────────────────────────────────────────
  const isDirty = isDraftDirty || isMetaDirty;

  function handleSaveRequest() {
    if (!isDirty) return;
    setShowSaveModal(true);
  }

  async function handleSaveConfirm() {
    if (!session) return;
    setSaving(true);
    try {
      await Promise.all([
        isDraftDirty && selected && draft ? (async () => {
          const updated: Note = {
            ...selected.note,
            title: draft.title,
            body: draft.body,
            updatedAt: new Date().toISOString(),
          };
          const content = await encryptNote(updated, session.keys);
          const newSha = await writeNoteFile(session.repo, session.pat, selected.path, content, selected.sha);
          setEntries((prev) =>
            prev.map((e) => e.note.id === updated.id ? { ...e, note: updated, sha: newSha } : e),
          );
          setIsDraftDirty(false);
        })() : Promise.resolve(),

        isMetaDirty ? (async () => {
          const owner = viewAs;
          const sha = activeMetaSha;
          const newSha = await saveMeta(session.repo, session.pat, session.keys, owner, activeMeta, sha);
          setActiveMetaSha(newSha);
          setIsMetaDirty(false);
        })() : Promise.resolve(),
      ]);

      setShowSaveModal(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleViewChange(v: "u1" | "u2") {
    setViewAs(v);
    setSelectedId(null);
    setDraft(null);
    setIsDraftDirty(false);
    setFilterTagIds([]);
  }

  function handleLock() {
    clearSession();
    navigate({ to: "/" });
  }

  if (!session) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface/50 shrink-0" style={{ backdropFilter: "blur(8px)" }}>
        <span className="text-sm font-semibold text-foreground mr-auto">Notes</span>

        {/* Error */}
        {error && (
          <span className="text-xs text-danger max-w-xs truncate" title={error}>{error}</span>
        )}

        {/* Save status */}
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-muted animate-fade-in">
            <span className="w-3 h-3 border-2 border-border border-t-accent rounded-full animate-spin inline-block" />
            Saving…
          </span>
        )}
        {savedFlash && !saving && (
          <span className="flex items-center gap-1 text-xs text-success animate-fade-in">
            <Check size={12} /> Saved
          </span>
        )}

        {/* Save button */}
        <button
          onClick={handleSaveRequest}
          disabled={!isDirty || saving}
          title={isDirty ? "Push to GitHub (Ctrl+S)" : "No unsaved changes"}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
            isDirty
              ? "bg-accent text-white border-accent hover:opacity-90 shadow-sm"
              : "text-muted border-border opacity-40"
          } disabled:cursor-default`}
        >
          {isDirty ? <CloudUpload size={13} /> : <Save size={13} />}
          {isDirty ? "Save" : "Saved"}
        </button>

        <ThemeToggle />

        <button
          onClick={handleLock}
          title="Lock"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Lock size={14} />
          <span className="hidden sm:inline">Lock</span>
        </button>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        <Sidebar
          entries={viewEntries}
          meta={activeMeta}
          selectedId={selectedId}
          filterTagIds={filterTagIds}
          session={session}
          viewAs={viewAs}
          loading={loading}
          saving={saving}
          onSelect={setSelectedId}
          onNew={handleNew}
          onDelete={handleDelete}
          onMetaChange={handleMetaChange}
          onViewChange={handleViewChange}
          onFilterTagsChange={setFilterTagIds}
        />

        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin inline-block" />
          </div>
        }>
          <NoteEditor
            entry={selected}
            meta={activeMeta}
            draft={draft}
            isDirty={isDraftDirty}
            canEdit={canEdit}
            viewingAsPartner={viewAs === "u2"}
            onChange={handleDraftChange}
            onTagsChange={handleTagsChange}
            onSave={handleSaveRequest}
          />
        </Suspense>
      </div>

      {/* ── Save modal ───────────────────────────────────────────────────── */}
      {showSaveModal && (
        <SaveModal
          saving={saving}
          onConfirm={handleSaveConfirm}
          onCancel={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
