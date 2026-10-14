/** Device person number (14, 15, 16). Empty means the employee has no fingerprint id yet. */
export function normalizeDeviceUserNo(
  value: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { ok: true, value: null };
  }

  if (!/^\d{1,12}$/.test(raw)) {
    return {
      ok: false,
      error: "Fingerprint number must be digits only, like 14, 15, or 16.",
    };
  }

  const normalized = raw.replace(/^0+/, "");
  if (!normalized) {
    return { ok: false, error: "Fingerprint number must be greater than 0." };
  }

  return { ok: true, value: normalized };
}

/** Lookup keys so "015" and "15" match the same employee. */
export function deviceUserNoLookupKeys(value: string): string[] {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/^0+/, "");
  return [...new Set([trimmed, normalized].filter(Boolean))];
}
