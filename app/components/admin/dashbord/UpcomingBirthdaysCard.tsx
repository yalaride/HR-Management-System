import React from "react";
import { Cake, Calendar } from "lucide-react";
import Link from "next/link";

export interface UpcomingBirthday {
  name: string;
  designation?: string;
  department?: string;
  profilePhotoUrl?: string;
  whenLabel: string;
  daysUntil: number;
}

interface UpcomingBirthdaysCardProps {
  upcoming: UpcomingBirthday[];
}

export default function UpcomingBirthdaysCard({ upcoming }: UpcomingBirthdaysCardProps) {
  if (!upcoming || upcoming.length === 0) return null;

  return (
    <div className="panel p-5 border border-line-subtle rounded-2xl bg-surface-card shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-line-subtle mb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <Cake className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-content-main">Upcoming Birthdays</h2>
            <p className="text-[10px] text-content-secondary">Next 7 days — so you can prepare</p>
          </div>
        </div>
        <Link
          href="/admin/birthdays"
          className="text-[10px] font-bold text-brand-accent hover:text-brand-hover transition"
        >
          View all
        </Link>
      </div>

      <ul className="space-y-2">
        {upcoming.slice(0, 5).map((emp, idx) => (
          <li
            key={`${emp.name}-${idx}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-surface-main/50 px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-brand-subtle text-brand-accent border border-brand-accent/15 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden relative">
                {(emp.name || "E")
                  .split(" ")
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
                {emp.profilePhotoUrl ? (
                  <img
                    src={emp.profilePhotoUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-content-main truncate">{emp.name}</p>
                <p className="text-[10px] text-content-secondary truncate">
                  {emp.designation || "Team member"}
                  {emp.department ? ` · ${emp.department}` : ""}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
              <Calendar className="w-3 h-3" />
              {emp.whenLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
