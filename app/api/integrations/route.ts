import { connection } from "next/server";
import { integrationStatus } from "@/lib/integrations/config";

export async function GET() {
  await connection();
  return Response.json(integrationStatus());
}
