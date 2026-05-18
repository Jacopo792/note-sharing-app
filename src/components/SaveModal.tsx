import { CloudUpload, X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveModal({ saving, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="bg-raised border border-border rounded-2xl shadow-2xl p-6 w-80 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
              <CloudUpload size={17} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Push to GitHub?</p>
              <p className="text-xs text-muted mt-0.5">Encrypts and commits changes</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-muted hover:text-foreground p-0.5 rounded-md transition-colors cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-sm border border-border rounded-lg text-foreground hover:bg-selected transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-3.5 py-1.5 text-sm bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <span className="w-3 h-3 border-2 rounded-full border-white/30 border-t-white animate-spin inline-block" />
                Pushing…
              </>
            ) : (
              "Push"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
