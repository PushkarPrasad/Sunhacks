import "server-only";

// Hoop Upload. The endpoint is configurable because Hoop's API was not available while building:
// POST multipart/form-data { file: <project zip>, metadata: <json> } with "Authorization: Bearer HOOP_API_KEY".
// Mock (no HOOP_UPLOAD_URL): nothing leaves the machine; the client downloads the same package instead.
export async function uploadToHoop(zip: Uint8Array, filename: string, metadata: Record<string, unknown>): Promise<{ mode: "live" | "mock"; url?: string; error?: string }> {
  const url = process.env.HOOP_UPLOAD_URL;
  if (!url) return { mode: "mock" };
  const form = new FormData();
  form.append("file", new Blob([zip as BlobPart], { type: "application/zip" }), filename);
  form.append("metadata", JSON.stringify(metadata));
  const res = await fetch(url, {
    method: "POST",
    headers: process.env.HOOP_API_KEY ? { authorization: `Bearer ${process.env.HOOP_API_KEY}` } : {},
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return { mode: "live", error: `Hoop responded ${res.status}` };
  const json = (await res.json().catch(() => ({}))) as { url?: string; id?: string };
  return { mode: "live", url: json.url };
}
