import "server-only";
import { env } from "./config";

// AWS S3 for exported board files. Mock: the browser downloads the file directly.
export async function uploadExport(key: string, body: Uint8Array | string, contentType: string): Promise<{ mode: "live" | "mock"; url?: string }> {
  if (!env.s3Bucket || !env.awsRegion) return { mode: "mock" };
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({ region: env.awsRegion });
  await s3.send(new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, Body: body, ContentType: contentType }));
  return { mode: "live", url: `https://${env.s3Bucket}.s3.${env.awsRegion}.amazonaws.com/${encodeURIComponent(key)}` };
}
