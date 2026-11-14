import { cookies } from "next/headers";
import { canViewFullAuditLogs } from "@/lib/audit-log-access";

export const DESK_COOKIE = "desk_open";

type DeskIdentity = {
  role?: string | null;
  email?: string | null;
} | null | undefined;

export function isDeskEligible(user: DeskIdentity): boolean {
  return user?.role === "employee" && canViewFullAuditLogs(user.email);
}

export async function isDeskOpen(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(DESK_COOKIE)?.value === "1";
}

export async function isDeskUser(user: DeskIdentity): Promise<boolean> {
  if (!isDeskEligible(user)) return false;
  return isDeskOpen();
}
