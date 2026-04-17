import { cn } from "@/lib/utils";

interface CseLogoProps {
  className?: string;
}

export function CseLogo({ className }: CseLogoProps) {
  return (
    <svg
      viewBox="0 0 180 120"
      role="img"
      aria-label="CSE Society logo"
      className={cn("h-16 w-auto", className)}
    >
      <rect width="180" height="120" rx="18" fill="#f4f6fb" />
      <g fill="#cdd3e3">
        <rect x="18" y="18" width="18" height="18" rx="3" />
        <rect x="42" y="18" width="18" height="18" rx="3" />
        <rect x="66" y="18" width="18" height="18" rx="3" />
        <rect x="90" y="18" width="18" height="18" rx="3" />
        <rect x="114" y="18" width="18" height="18" rx="3" />
        <rect x="138" y="18" width="18" height="18" rx="3" />

        <rect x="18" y="42" width="18" height="18" rx="3" />
        <rect x="42" y="42" width="18" height="18" rx="3" />
        <rect x="66" y="42" width="18" height="18" rx="3" />
        <rect x="90" y="42" width="18" height="18" rx="3" />
        <rect x="114" y="42" width="18" height="18" rx="3" />
        <rect x="138" y="42" width="18" height="18" rx="3" />

        <rect x="18" y="66" width="18" height="18" rx="3" opacity="0.6" />
        <rect x="42" y="66" width="18" height="18" rx="3" opacity="0.6" />
        <rect x="66" y="66" width="18" height="18" rx="3" opacity="0.6" />
        <rect x="90" y="66" width="18" height="18" rx="3" opacity="0.6" />
        <rect x="114" y="66" width="18" height="18" rx="3" opacity="0.6" />
        <rect x="138" y="66" width="18" height="18" rx="3" opacity="0.6" />
      </g>

      <path
        d="M118 24C144 18 168 36 150 66"
        fill="none"
        stroke="#e3422a"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <text
        x="24"
        y="78"
        fill="#e3422a"
        fontFamily="'Segoe UI', 'Trebuchet MS', sans-serif"
        fontWeight="700"
        fontSize="48"
        letterSpacing="2"
      >
        CSE
      </text>

      <text
        x="26"
        y="104"
        fill="#1e1f26"
        fontFamily="'Georgia', serif"
        fontSize="16"
        letterSpacing="6"
      >
        SOCIETY
      </text>
    </svg>
  );
}
