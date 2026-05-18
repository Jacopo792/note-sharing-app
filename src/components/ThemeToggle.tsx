import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { type Theme, getTheme, setTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>(getTheme);

  function pick(t: Theme) {
    setTheme(t);
    setLocal(t);
  }

  return (
    <div className="flex items-center gap-0.5 bg-surface border border-border rounded-lg p-0.5">
      {(
        [
          ["light", <Sun size={13} />, "Light"],
          ["device", <Monitor size={13} />, "System"],
          ["dark", <Moon size={13} />, "Dark"],
        ] as [Theme, React.ReactNode, string][]
      ).map(([t, icon, label]) => (
        <button
          key={t}
          title={label}
          onClick={() => pick(t)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            theme === t
              ? "bg-background text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
