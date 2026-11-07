import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Employee } from "@/modals/Employee";
import { deviceUserNoLookupKeys } from "@/lib/device-user-no";
import { recordDevicePunch } from "@/lib/attendance-service";

const FAIL_SUB_EVENTS = new Set([
  6, 7, 8, 9, 10, 21, 22, 23, 39, 40, 41, 42, 43, 44, 45, 46, 51, 52, 76, 77, 78, 79, 80,
]);

// HikCentral Access Control access-denied event types.
const FAIL_CENTRAL_EVENTS = new Set([197127, 197128, 197151, 197160, 197161]);

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

function classifyPunch(
  employeeNo: string | null,
  dateTime: string | null,
  eventType: string | null,
  subEventType: string | null
): ParsedHikvisionEvent {
  if (eventType && /heartbeat|videoloss/i.test(eventType)) {
    return { kind: "heartbeat" };
  }

  const centralCode = eventType ? Number(eventType) : NaN;
  if (Number.isFinite(centralCode) && FAIL_CENTRAL_EVENTS.has(centralCode)) {
    return { kind: "ignored" };
  }

  if (!employeeNo || employeeNo === "0") {
    return { kind: "ignored" };
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

function parseCentralEvents(json: unknown): ParsedHikvisionEvent[] | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const params = (json as Record<string, unknown>).params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const events = (params as Record<string, unknown>).events;
  if (!Array.isArray(events)) return null;

  return events.map((event) => {
    if (!event || typeof event !== "object") return { kind: "ignored" as const };
    const record = event as Record<string, unknown>;
    const data =
      record.data && typeof record.data === "object" && !Array.isArray(record.data)
        ? (record.data as Record<string, unknown>)
        : record;
    const employeeNo =
      readJsonString(data.personCode) ||
      readJsonString(data.employeeNoString) ||
      readJsonString(data.employeeNo) ||
      readJsonString(record.personCode);
    const dateTime = readJsonString(record.happenTime) || readJsonString(record.sendTime);
    const eventType = readJsonString(record.eventType);
    return classifyPunch(employeeNo, dateTime, eventType, null);
  });
}

export function parseHikvisionEvents(body: string): ParsedHikvisionEvent[] {
  const trimmed = body.trim();
  if (!trimmed) return [{ kind: "ignored" }];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      const central = parseCentralEvents(json);
      if (central) return central.length > 0 ? central : [{ kind: "ignored" }];

      return [
        classifyPunch(
          findInJson(json, ["employeeNoString", "employeeNo", "employeeNoID", "personCode"]),
          findInJson(json, ["dateTime", "happenTime", "time"]),
          findInJson(json, ["eventType", "event_type"]),
          findInJson(json, ["subEventType", "minor"])
        ),
      ];
    } catch {
      return [{ kind: "ignored" }];
    }
  }

  return [
    classifyPunch(
      tagValue(trimmed, "employeeNoString") ||
        tagValue(trimmed, "employeeNo") ||
        tagValue(trimmed, "employeeNoID") ||
        tagValue(trimmed, "personCode"),
      tagValue(trimmed, "dateTime") || tagValue(trimmed, "happenTime"),
      tagValue(trimmed, "eventType"),
      tagValue(trimmed, "subEventType") || tagValue(trimmed, "minor")
    ),
  ];
}

export function parseHikvisionEvent(body: string): ParsedHikvisionEvent {
  const events = parseHikvisionEvents(body);
  return events.find((event) => event.kind === "punch") || events[0] || { kind: "ignored" };
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
  const punches = parseHikvisionEvents(body).filter(
    (event) => event.kind === "punch" && event.employeeNo && event.punchedAt
  );
  if (punches.length === 0) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await dbConnect();
  const results = [];
  for (const event of punches) {
    const keys = deviceUserNoLookupKeys(event.employeeNo as string);
    const employee = await Employee.findOne({ deviceUserNo: { $in: keys } })
      .select("userId status deviceUserNo name")
      .lean<{ userId?: unknown; status?: string } | null>();

    if (!employee?.userId) {
      console.warn(`Hikvision punch ${keys.join("/")} did not match an employee.`);
      results.push({ matched: false });
      continue;
    }

    if (employee.status === "Inactive" || employee.status === "Terminated") {
      results.push({ matched: true, ignored: "inactive" });
      continue;
    }

    const result = await recordDevicePunch({
      userId: String(employee.userId),
      punchedAt: event.punchedAt as Date,
    });

    if (!result.ok) {
      console.error("Hikvision punch rejected:", result.error);
      results.push({ matched: true, stored: false });
      continue;
    }

    results.push({
      matched: true,
      stored: result.action !== "duplicate",
      action: result.action,
      status: result.status,
    });
  }

  const first = results[0];
  return NextResponse.json({ ok: true, ...first, count: results.length });
}
