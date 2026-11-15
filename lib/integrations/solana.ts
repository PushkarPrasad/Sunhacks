// Solana Pay transfer request for a devnet demo. Pure: builds a `solana:` URL; no keys, no mainnet.
// Spec: https://docs.solanapay.com/spec

export const SOLANA_ENABLED = process.env.NEXT_PUBLIC_SOLANA_DEVNET === "true";
export const SOLANA_RECIPIENT = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RECIPIENT ?? "";

export function solanaPayUrl(opts: { recipient: string; amountSol: number; label: string; message: string; memo?: string }): string {
  const p = new URLSearchParams({ amount: opts.amountSol.toFixed(4), label: opts.label, message: opts.message, ...(opts.memo ? { memo: opts.memo } : {}) });
  return `solana:${opts.recipient}?${p.toString()}`;
}

/** Devnet SOL is free test money; we convert USD with a fixed demo rate, shown in the UI. */
export const DEMO_USD_PER_SOL = 150;
