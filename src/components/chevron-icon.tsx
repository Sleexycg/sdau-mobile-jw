import type { CSSProperties } from "react";

interface ChevronIconProps {
  expanded?: boolean;
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export function ChevronIcon({ expanded = false, size = 14, color = "currentColor", style, className }: ChevronIconProps) {
  return (
    <svg
      className={className}
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{
        display: "inline-block",
        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 220ms ease",
        ...style,
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
