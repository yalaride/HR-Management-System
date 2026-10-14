import { handleHikvisionEvent, hikvisionProbeResponse } from "@/lib/hikvision-listener";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return hikvisionProbeResponse(token);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return handleHikvisionEvent(request, token);
}
