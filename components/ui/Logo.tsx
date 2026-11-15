export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-ink)" />
      <path d="M8 22h6l4-8h6" fill="none" stroke="var(--color-copper)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="22" r="2.5" fill="var(--color-paper)" />
      <circle cx="24" cy="14" r="2.5" fill="var(--color-paper)" />
    </svg>
  );
}
