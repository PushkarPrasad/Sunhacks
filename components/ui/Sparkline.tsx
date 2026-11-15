export function Sparkline({ values, stroke = "var(--color-copper)" }: { values: number[]; stroke?: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32 - 2}`).join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={`Price from $${first.toFixed(2)} to $${last.toFixed(2)}`}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
