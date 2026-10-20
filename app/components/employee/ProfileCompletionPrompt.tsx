"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserRound } from "lucide-react";

type CompletionPayload = {
  profileComplete?: boolean;
  completionPercent?: number;
  missingFields?: string[];
};

export default function ProfileCompletionPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dismissedPath, setDismissedPath] = useState<string | null>(null);

  useEffect(() => {
    if (dismissedPath === pathname) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/employee/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as CompletionPayload;
        if (cancelled) return;
        if (data.profileComplete) {
          setOpen(false);
          return;
        }
        setPercent(typeof data.completionPercent === "number" ? data.completionPercent : 0);
        setMissingFields(Array.isArray(data.missingFields) ? data.missingFields : []);
        setOpen(true);
      } catch {
        setOpen(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname, dismissedPath]);

  if (!open) return null;

  const onProfilePage = pathname === "/employee/profile";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-completion-title"
        className="w-full max-w-md rounded-2xl border border-line-subtle bg-surface-card p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand-accent">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="profile-completion-title" className="text-base font-bold text-content-main">
              Complete your profile
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
              Your profile is {percent}% complete. Finish the remaining details so HR has your current record.
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-accent" style={{ width: `${percent}%` }} />
        </div>

        {missingFields.length > 0 && (
          <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-content-secondary">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setDismissedPath(pathname);
              setOpen(false);
            }}
            className="rounded-xl border border-line-subtle px-4 py-2.5 text-xs font-bold text-content-secondary"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissedPath("/employee/profile");
              setOpen(false);
              if (!onProfilePage) router.push("/employee/profile");
            }}
            className="rounded-xl bg-brand-accent px-4 py-2.5 text-xs font-bold text-white"
          >
            {onProfilePage ? "Fill the form" : "Complete profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
