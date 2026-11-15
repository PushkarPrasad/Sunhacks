import "server-only";

// One place that says which services are live. Every adapter falls back to a local mock when its env is missing.
export const env = {
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  tinyfishKey: process.env.TINYFISH_API_KEY,
  tinyfishUrl: process.env.TINYFISH_API_URL ?? "https://agent.tinyfish.ai/v1/automation/run",
  mongoUri: process.env.MONGODB_URI,
  mongoDb: process.env.MONGODB_DB ?? "copperline",
  tigerUrl: process.env.TIGER_DATABASE_URL,
  awsRegion: process.env.AWS_REGION,
  s3Bucket: process.env.S3_BUCKET,
  notesServiceUrl: process.env.NOTES_SERVICE_URL,
};

export type Mode = "live" | "mock";

export function integrationStatus(): Record<string, Mode> {
  return {
    gemini: env.geminiKey ? "live" : "mock",
    tinyfish: env.tinyfishKey ? "live" : "mock",
    mongodb: env.mongoUri ? "live" : "mock",
    tigerdata: env.tigerUrl ? "live" : "mock",
    aws: env.s3Bucket && env.awsRegion ? "live" : "mock",
    notesService: env.notesServiceUrl ? "live" : "mock",
    solana: process.env.NEXT_PUBLIC_SOLANA_DEVNET === "true" ? "live" : "mock",
  };
}

/** fetch with a timeout; adapters never hang a page. */
export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
