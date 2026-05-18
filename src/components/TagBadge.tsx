import { X } from "lucide-react";
import { TAG_COLORS, type Tag } from "@/lib/types";
import { useIsDark } from "@/lib/theme";

interface Props {
  tag: Tag;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  size?: "sm" | "xs";
}

export function TagBadge({ tag, onRemove, onClick, active, size = "sm" }: Props) {
  const isDark = useIsDark();
  const palette = TAG_COLORS.find((c) => c.id === tag.color) ?? TAG_COLORS[0];
  const bg = isDark ? palette.darkBg : palette.bg;
  const fg = isDark ? palette.darkFg : palette.fg;

  const baseClass = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span
      onClick={onClick}
      style={{ backgroundColor: bg, color: fg, opacity: active === false ? 0.45 : 1 }}
      className={`inline-flex items-center gap-1 rounded-full font-medium select-none ${baseClass} ${
        onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
      }`}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="rounded-full hover:opacity-60 cursor-pointer transition-opacity leading-none"
          style={{ color: fg }}
        >
          <X size={9} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
