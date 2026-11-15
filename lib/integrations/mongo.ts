import "server-only";
import type { Build } from "@/lib/types";
import { env } from "./config";

// MongoDB Atlas: parts, categories, templates and saved builds. Mock: in-memory map (the browser also keeps
// the current build in localStorage, so the app works fully offline).

const memory = new Map<string, Build>();
let client: import("mongodb").MongoClient | null = null;

async function collection(name: string) {
  if (!env.mongoUri) return null;
  if (!client) {
    const { MongoClient } = await import("mongodb");
    client = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
  }
  return client.db(env.mongoDb).collection(name);
}

export async function saveBuild(b: Build): Promise<{ id: string; mode: "live" | "mock" }> {
  const col = await collection("builds").catch(() => null);
  if (col) {
    await col.replaceOne({ id: b.id }, { ...b, savedAt: new Date() }, { upsert: true });
    return { id: b.id, mode: "live" };
  }
  memory.set(b.id, b);
  return { id: b.id, mode: "mock" };
}

export async function loadBuild(id: string): Promise<Build | null> {
  const col = await collection("builds").catch(() => null);
  if (col) {
    const doc = await col.findOne({ id }, { projection: { _id: 0 } });
    return (doc as unknown as Build) ?? null;
  }
  return memory.get(id) ?? null;
}
