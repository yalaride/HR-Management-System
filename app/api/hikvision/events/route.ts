import { handleHikvisionEvent, hikvisionProbeResponse } from "@/lib/hikvision-listener";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  return hikvisionProbeResponse(token);
}

export async function POST(request: Request) {
  return handleHikvisionEvent(request);
}
