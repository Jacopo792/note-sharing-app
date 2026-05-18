import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { restoreSession, clearSession, type AppSession } from "@/lib/session";
import { decryptFile, encryptNote, type Note } from "@/lib/crypto";
import {
  fetchNoteFiles,
  writeNoteFile,
  deleteNoteFile,
  ensureDataBranch,
} from "@/lib/github";

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

interface NoteEntry {
  note: Note;
  sha: string;
  path: string;
}

function NotesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AppSession | null>(null);
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      const files = await fetchNoteFiles(s.repo, s.pat);
      const decrypted: NoteEntry[] = [];
      await Promise.all(
        files.map(async (f) => {
          const note = await decryptFile(f.content, s.keys);
          if (note) decrypted.push({ note, sha: f.sha, path: f.path });
        }),
      );
      decrypted.sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt));
      setEntries(decrypted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }

  const selected = entries.find((e) => e.note.id === selectedId) ?? null;
  const canEdit = selected
    ? session?.role === "u1" || selected.note.owner === "u2"
    : false;

  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selected && selected.note.id !== lastIdRef.current) {
      setDraft({ title: selected.note.title, body: selected.note.body });
      lastIdRef.current = selected.note.id;
    }
  }, [selected]);

  const handleNew = useCallback(async () => {
    if (!session) return;
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      owner: session.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    setError("");
    try {
      const fileContent = await encryptNote(note, session.keys);
      const path = `notes/${note.id}.napp`;
      const sha = await writeNoteFile(session.repo, session.pat, path, fileContent);
      setEntries((prev) => [{ note, sha, path }, ...prev]);
      setSelectedId(note.id);
      setDraft({ title: "", body: "" });
      lastIdRef.current = note.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create note");
    } finally {
      setSaving(false);
    }
  }, [session]);

  const saveDraft = useCallback(async () => {
    if (!selected || !session || !canEdit) return;
    if (draft.title === selected.note.title && draft.body === selected.note.body) return;
    const updated: Note = {
      ...selected.note,
      title: draft.title,
      body: draft.body,
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    setError("");
    try {
      const fileContent = await encryptNote(updated, session.keys);
      const newSha = await writeNoteFile(
        session.repo,
        session.pat,
        selected.path,
        fileContent,
        selected.sha,
      );
      setEntries((prev) =>
        prev.map((e) =>
          e.note.id === updated.id ? { note: updated, sha: newSha, path: e.path } : e,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [selected, session, canEdit, draft]);

  const handleDelete = useCallback(
    async (entry: NoteEntry) => {
      if (!session) return;
      setSaving(true);
      setError("");
      try {
        await deleteNoteFile(session.repo, session.pat, entry.path, entry.sha);
        setEntries((prev) => prev.filter((e) => e.note.id !== entry.note.id));
        if (selectedId === entry.note.id) setSelectedId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      } finally {
        setSaving(false);
      }
    },
    [session, selectedId],
  );

  function handleLock() {
    clearSession();
    navigate({ to: "/" });
  }

  if (!session) return null;

  const myEntries = entries.filter((e) => e.note.owner === session.role);
  const u2Entries = session.role === "u1" ? entries.filter((e) => e.note.owner === "u2") : [];

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground">Notes</span>
        <div className="flex items-center gap-4">
          {saving && <span className="text-xs text-muted">Saving…</span>}
          {error && (
            <span className="text-xs text-danger max-w-xs truncate" title={error}>
              {error}
            </span>
          )}
          <button
            onClick={handleLock}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-64 border-r border-border flex flex-col shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              My Notes
            </span>
            <button
              onClick={handleNew}
              disabled={saving || loading}
              className="text-accent text-xl leading-none disabled:opacity-40"
              title="New note"
            >
              +
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-3 text-sm text-muted">Loading…</p>
            ) : (
              <>
                {myEntries.length === 0 && (
                  <p className="px-4 py-3 text-sm text-muted">No notes yet</p>
                )}
                {myEntries.map((e) => (
                  <NoteRow
                    key={e.note.id}
                    entry={e}
                    selected={selectedId === e.note.id}
                    onClick={() => setSelectedId(e.note.id)}
                    onDelete={() => handleDelete(e)}
                  />
                ))}

                {u2Entries.length > 0 && (
                  <>
                    <div className="px-4 py-3 border-t border-border">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted">
                        U2 Notes
                      </span>
                    </div>
                    {u2Entries.map((e) => (
                      <NoteRow
                        key={e.note.id}
                        entry={e}
                        selected={selectedId === e.note.id}
                        onClick={() => setSelectedId(e.note.id)}
                        onDelete={() => handleDelete(e)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted">
              {loading ? "Loading…" : "Select or create a note"}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {session.role === "u1" && selected.note.owner === "u2" && (
                <div className="px-8 pt-6 pb-0">
                  <span className="text-xs text-muted border border-border rounded px-1.5 py-0.5">
                    u2
                  </span>
                </div>
              )}
              <div className="flex-1 flex flex-col px-8 py-6 overflow-hidden">
                <input
                  value={canEdit ? draft.title : selected.note.title}
                  onChange={(e) =>
                    canEdit && setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  onBlur={saveDraft}
                  placeholder="Title"
                  readOnly={!canEdit}
                  className="text-2xl font-semibold mb-4 outline-none bg-transparent border-none w-full"
                />
                <textarea
                  value={canEdit ? draft.body : selected.note.body}
                  onChange={(e) =>
                    canEdit && setDraft((d) => ({ ...d, body: e.target.value }))
                  }
                  onBlur={saveDraft}
                  placeholder="Start writing…"
                  readOnly={!canEdit}
                  className="flex-1 resize-none outline-none bg-transparent border-none text-base leading-relaxed w-full"
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function NoteRow({
  entry,
  selected,
  onClick,
  onDelete,
}: {
  entry: NoteEntry;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer border-b border-border ${
        selected ? "bg-selected" : "hover:bg-selected"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {entry.note.title || "Untitled"}
          </p>
          <p className="text-xs text-muted truncate mt-0.5">
            {entry.note.body || "No content"}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-sm text-muted hover:text-danger shrink-0 mt-0.5 leading-none"
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}
