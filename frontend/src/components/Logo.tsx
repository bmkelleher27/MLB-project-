/**
 * Site mark: the scorebook diamond with the run traced home — the same visual
 * the scorecard uses for a scored run. Keep in sync with public/favicon.svg,
 * which is a standalone copy of this drawing.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className="logo-mark"
    >
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#11639f" />
          <stop offset="1" stopColor="#083a66" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#logo-tile)" />
      {/* basepaths, traced like a scored run */}
      <path
        d="M32 54 L53 33 L32 12 L11 33 Z"
        fill="rgba(255,255,255,0.08)"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* bags at first, second, third */}
      <rect x="49.5" y="29.5" width="7" height="7" rx="1.5" fill="#ffffff" transform="rotate(45 53 33)" />
      <rect x="28.5" y="8.5" width="7" height="7" rx="1.5" fill="#ffffff" transform="rotate(45 32 12)" />
      <rect x="7.5" y="29.5" width="7" height="7" rx="1.5" fill="#ffffff" transform="rotate(45 11 33)" />
      {/* the run crosses home */}
      <path d="M25.5 48.5 H38.5 V53 L32 57.8 L25.5 53 Z" fill="#3dbd77" />
    </svg>
  );
}
