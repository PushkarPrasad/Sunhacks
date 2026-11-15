"use client";

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-2 text-left text-sm hover:bg-paper"
    >
      <span>{label}</span>
      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-copper" : "bg-line-strong"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
