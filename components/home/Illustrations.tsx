// Line illustrations for the home blocks. Pure SVG, generic shapes only.

export function ExplodedIllustration() {
  const layers = [
    { y: 112, fill: "var(--color-card)", label: "Enclosure" },
    { y: 84, fill: "#efe7da", label: "Battery" },
    { y: 56, fill: "var(--color-pcb)", label: "Board" },
    { y: 28, fill: "#dfe6ec", label: "Display" },
  ];
  return (
    <svg viewBox="0 0 220 170" className="h-full w-full" aria-hidden="true">
      {layers.map((l, i) => (
        <g key={l.label} transform={`translate(${20 + i * 6} ${l.y})`}>
          <path d="M0 18 L80 0 L160 18 L80 36 Z" fill={l.fill} stroke="var(--color-ink)" strokeWidth="1.2" strokeLinejoin="round" />
          {l.label === "Board" && (
            <>
              <rect x="66" y="12" width="20" height="10" transform="skewY(-12) translate(0 14)" fill="var(--color-copper)" />
              <path d="M30 18 L60 11 M100 25 L130 18" stroke="var(--color-copper)" strokeWidth="1.4" />
            </>
          )}
          <line x1="166" y1="18" x2="186" y2="18" stroke="var(--color-line-strong)" strokeWidth="1" />
          <text x="190" y="21" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-muted)">
            {String(i + 1).padStart(2, "0")}
          </text>
        </g>
      ))}
      <path d="M100 30 V150" stroke="var(--color-line-strong)" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
}

export function ScratchIllustration() {
  return (
    <svg viewBox="0 0 220 170" className="h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="var(--color-line-strong)" />
        </pattern>
      </defs>
      <rect x="10" y="10" width="200" height="150" rx="10" fill="url(#dots)" stroke="var(--color-line)" />
      <rect x="28" y="40" width="58" height="84" rx="6" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="1.2" />
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={`l${i}`} cx="28" cy={54 + i * 11} r="2.4" fill="var(--color-ink)" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={`r${i}`} cx="86" cy={54 + i * 11} r="2.4" fill="var(--color-ink)" />
      ))}
      <rect x="140" y="34" width="52" height="40" rx="6" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="1.2" />
      <rect x="140" y="96" width="52" height="40" rx="6" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="1.2" />
      <circle cx="140" cy="48" r="2.4" fill="var(--color-ink)" />
      <circle cx="140" cy="60" r="2.4" fill="var(--color-ink)" />
      <circle cx="140" cy="110" r="2.4" fill="var(--color-ink)" />
      <circle cx="140" cy="122" r="2.4" fill="var(--color-ink)" />
      <path d="M86 54 C112 54 112 48 140 48" fill="none" stroke="var(--color-copper)" strokeWidth="1.8" />
      <path d="M86 65 C114 65 114 60 140 60" fill="none" stroke="var(--color-copper)" strokeWidth="1.8" />
      <path d="M86 98 C112 98 112 110 140 110" fill="none" stroke="var(--color-copper)" strokeWidth="1.8" />
      <path d="M86 109 C114 109 110 122 140 122" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" />
    </svg>
  );
}
