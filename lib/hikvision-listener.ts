import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";
import { deviceUserNoLookupKeys } from "@/lib/device-user-no";
import { recordDevicePunch } from "@/lib/attendance-service";

const FAIL_SUB_EVENTS = new Set([
  6, 7, 8, 9, 10, 21, 22, 23, 39, 40, 41, 42, 43, 44, 45, 46, 51, 52, 76, 77, 78, 79, 80,
]);

function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hikvisionTokenAccepted(request: Request, pathToken?: string | null): boolean {
  const expected = process.env.HIKVISION_LISTENER_SECRET?.trim();
  if (!expected) return false;

  const url = new URL(request.url);
  const header = request.headers.get("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;

  return [pathToken, url.searchParams.get("token"), request.headers.get("x-hikvision-token"), bearer].some(
    (candidate) => secretsMatch(candidate, expected)
  );
}

function tagValue(source: string, tag: string): string | null {
  const match = source.match(new RegExp(`<${tag}[^>]*>\\s*([^<]*?)\\s*</${tag}>`, "i"));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function readJsonString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function findInJson(node: unknown, keys: string[]): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findInJson(item, keys);
      if (found) return found;
    }
    return null;
  }

  const record = node as Record<string, unknown>;
  for (const key of keys) {
    const direct = readJsonString(record[key]);
    if (direct) return direct;
  }
  for (const value of Object.values(record)) {
    const found = findInJson(value, keys);
    if (found) return found;
  }
  return null;
}

/** Device local time without a zone is Pakistan time (UTC+5, no daylight saving). */
export function parseDeviceDateTime(raw: string | null): Date {
  if (!raw) return new Date();
  const trimmed = raw.trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 5,
      Number(minute),
      Number(second)
    )
  );
}

export interface ParsedHikvisionEvent {
  kind: "heartbeat" | "ignored" | "punch";
  employeeNo?: string;
  punchedAt?: Date;
}

export function parseHikvisionEvent(body: string): ParsedHikvisionEvent {
  const trimmed = body.trim();
  if (!trimmed) return { kind: "ignored" };

  let employeeNo: string | null = null;
  let dateTime: string | null = null;
  let eventType: string | null = null;
  let subEventType: string | null = null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      eventType = findInJson(json, ["eventType", "event_type"]);
      employeeNo = findInJson(json, ["employeeNoString", "employeeNo", "employeeNoID"]);
      dateTime = findInJson(json, ["dateTime", "time"]);
      subEventType = findInJson(json, ["subEventType", "minor"]);
    } catch {
      return { kind: "ignored" };
    }
  } else {
    eventType = tagValue(trimmed, "eventType");
    employeeNo =
      tagValue(trimmed, "employeeNoString") ||
      tagValue(trimmed, "employeeNo") ||
      tagValue(trimmed, "employeeNoID");
    dateTime = tagValue(trimmed, "dateTime");
    subEventType = tagValue(trimmed, "subEventType") || tagValue(trimmed, "minor");
  }

  if (eventType && /heartbeat|videoloss/i.test(eventType)) {
    return { kind: "heartbeat" };
  }

  if (!employeeNo || employeeNo === "0") {
    return { kind: eventType && /heartbeat/i.test(eventType) ? "heartbeat" : "ignored" };
  }

  const subCode = subEventType ? Number(subEventType) : NaN;
  if (Number.isFinite(subCode) && FAIL_SUB_EVENTS.has(subCode)) {
    return { kind: "ignored" };
  }

  return {
    kind: "punch",
    employeeNo,
    punchedAt: parseDeviceDateTime(dateTime),
  };
}

export function hikvisionProbeResponse(token: string | null): NextResponse {
  const expected = process.env.HIKVISION_LISTENER_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "HIKVISION_LISTENER_SECRET is not set on the server." },
      { status: 503 }
    );
  }
  if (!secretsMatch(token, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, listener: "hikvision" });
}

export async function handleHikvisionEvent(
  request: Request,
  pathToken?: string | null
): Promise<NextResponse> {
  const expected = process.env.HIKVISION_LISTENER_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "HIKVISION_LISTENER_SECRET is not set on the server." },
      { status: 503 }
    );
  }
  if (!hikvisionTokenAccepted(request, pathToken)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.text();
  const event = parseHikvisionEvent(body);
  if (event.kind !== "punch" || !event.employeeNo || !event.punchedAt) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await dbConnect();
  const keys = deviceUserNoLookupKeys(event.employeeNo);
  const employee = await Employee.findOne({ deviceUserNo: { $in: keys } })
    .select("userId status deviceUserNo name")
    .lean<{ userId?: unknown; status?: string } | null>();

  if (!employee?.userId) {
    console.warn(`Hikvision punch ${keys.join("/")} did not match an employee.`);
    return NextResponse.json({ ok: true, matched: false });
  }

  if (employee.status === "Inactive" || employee.status === "Terminated") {
    return NextResponse.json({ ok: true, matched: true, ignored: "inactive" });
  }

  const result = await recordDevicePunch({
    userId: String(employee.userId),
    punchedAt: event.punchedAt,
  });

  if (!result.ok) {
    console.error("Hikvision punch rejected:", result.error);
    return NextResponse.json({ ok: true, matched: true, stored: false });
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    stored: result.action !== "duplicate",
    action: result.action,
    status: result.status,
  });
}
