import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createSession } from "@/lib/session";

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1 text-center">Notes</h1>
        <p className="text-sm text-muted text-center mb-8">Paste your key to continue</p>

        <div className="flex flex-col gap-3">
          <textarea
            autoFocus
            rows={3}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleUnlock();
            }}
            placeholder="eyJ0eXBlIjoidTEi…"
            className="w-full px-3 py-2 border border-border rounded-md outline-none focus:border-accent resize-none text-sm font-mono"
          />
          <button
            disabled={loading || !token.trim()}
            onClick={handleUnlock}
            className="w-full py-3 border border-border rounded-md text-accent hover:bg-selected disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : "Unlock"}
          </button>
          {error && <p className="text-danger text-sm text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
