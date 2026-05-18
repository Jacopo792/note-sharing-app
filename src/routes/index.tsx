import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { createSession } from "@/lib/session";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlock() {
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createSession(token.trim());
      navigate({ to: "/notes" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid key");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-sm font-semibold text-foreground">Notes</span>
        <ThemeToggle />
      </div>

      {/* Center card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
              style={{ background: "color-mix(in srgb, var(--accent) 10%, var(--surface))" }}
            >
              <Lock size={24} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Unlock Notes</h1>
            <p className="text-sm text-muted mt-1">Paste your key bundle to continue</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-3 text-muted pointer-events-none" />
                <textarea
                  autoFocus
                  rows={3}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleUnlock();
                  }}
                  placeholder="eyJ0eXBlIjoidTEi…"
                  className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-xl outline-none focus:border-accent text-sm font-mono resize-none transition-colors"
                />
              </div>
              <button
                disabled={loading || !token.trim()}
                onClick={handleUnlock}
                className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Unlocking…
                  </>
                ) : (
                  "Unlock"
                )}
              </button>
              {error && (
                <p className="text-danger text-xs text-center animate-slide-up">{error}</p>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted text-center mt-4">
            Ctrl+Enter to unlock &nbsp;·&nbsp; Your key never leaves this device
          </p>
        </div>
      </div>
    </div>
  );
}
