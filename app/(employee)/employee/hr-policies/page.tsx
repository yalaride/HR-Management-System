"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Layers,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { FilterSelect } from "@/app/components/ui/FilterSelect";

type PolicyCategory =
  | "general"
  | "attendance"
  | "conduct"
  | "leaves"
  | "benefits"
  | "security"
  | "safety";

type PolicyPriority = "standard" | "important" | "critical";

interface PolicySection {
  _id?: string;
  number: number;
  title: string;
  category?: PolicyCategory;
  priority?: PolicyPriority;
  summary?: string;
  content: string;
  order: number;
  published: boolean;
  requiresAcknowledgement?: boolean;
}

const CATEGORY_STYLES: Record<string, { label: string; badge: string }> = {
  general: { label: "General", badge: "bg-surface-main text-content-secondary border-line-subtle" },
  attendance: { label: "Attendance", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  conduct: { label: "Conduct & Ethics", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  leaves: { label: "Leaves", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  benefits: { label: "Benefits & Perks", badge: "bg-brand-subtle text-brand-hover border-brand-subtle" },
  security: { label: "IT & Security", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  safety: { label: "Health & Safety", badge: "bg-teal-50 text-teal-700 border-teal-200" },
};

const PRIORITY_BADGES: Record<string, { label: string; badge: string }> = {
  standard: { label: "Standard", badge: "bg-surface-main text-content-muted border-line-subtle" },
  important: { label: "Important", badge: "bg-amber-50 text-amber-700 border-amber-200 font-semibold" },
  critical: { label: "Critical", badge: "bg-rose-50 text-rose-700 border-rose-200 font-bold" },
};

export default function EmployeeHRPoliciesPage() {
  const [sections, setSections] = useState<PolicySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Interactive UI State
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  // Restore marked-as-read sections from localStorage (lazy init; localStorage is unavailable during SSR)
  const [readSections, setReadSections] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("syncup_employee_read_policies");
      return saved ? (JSON.parse(saved) as Record<number, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    fetch("/api/employee/hr-policies")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load HR policy.");
        const fetchedSections = data.sections || [];
        setSections(fetchedSections);

        // Open the first section by default
        if (fetchedSections.length > 0) {
          setOpenSections({ [fetchedSections[0].number]: true });
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load HR policy."))
      .finally(() => setLoading(false));
  }, []);

  // Accordion Toggle
  const toggleSection = (number: number) => {
    setOpenSections((prev) => ({
      ...prev,
      [number]: !prev[number],
    }));
  };

  const expandAll = (open: boolean) => {
    const map: Record<number, boolean> = {};
    sections.forEach((s) => {
      map[s.number] = open;
    });
    setOpenSections(map);
  };

  // Toggle "Mark as Read"
  const toggleReadStatus = (number: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setReadSections((prev) => {
      const updated = { ...prev, [number]: !prev[number] };
      try {
        localStorage.setItem("syncup_employee_read_policies", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Filtering
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.summary && s.summary.toLowerCase().includes(searchQuery.toLowerCase()));

      const category = s.category || "general";
      const matchesCat = selectedCategory === "all" || category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [sections, searchQuery, selectedCategory]);

  const readCount = sections.filter((s) => readSections[s.number]).length;
  const progressPercent = sections.length > 0 ? Math.round((readCount / sections.length) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-pulse">
        <div className="h-28 rounded-2xl bg-surface-card border border-line-subtle" />
        <div className="h-12 rounded-xl bg-surface-main" />
        <div className="space-y-3">
          <div className="h-20 rounded-2xl bg-surface-card border border-line-subtle" />
          <div className="h-20 rounded-2xl bg-surface-card border border-line-subtle" />
          <div className="h-20 rounded-2xl bg-surface-card border border-line-subtle" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ── */}
      <header className="flex flex-col gap-4 pb-6 border-b border-line-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-content-main">
              Employee HR Policy
            </h1>
            <p className="mt-1 text-xs text-content-secondary max-w-2xl leading-relaxed">
              Please review the company guidelines, policies, and workplace conduct standards.
            </p>
          </div>

          {/* Reading Progress Pill */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-line-subtle pt-3 sm:pt-0 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
              Handbook Progress
            </span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 h-2 rounded-full bg-surface-main overflow-hidden border border-line-subtle">
                <div
                  className="h-full bg-brand-accent transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-content-main">{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Meta Bar */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-content-muted">
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-brand-accent" /> {sections.length} Clauses Published
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="size-3.5" /> {readCount} of {sections.length} Reviewed
          </span>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <FileText className="size-4 shrink-0 text-rose-600" />
          {error}
        </div>
      )}

      {/* ── Toolbar: Search, Filter, Expand All ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[220px] max-w-xs flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-content-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search policy terms..."
              className="w-full rounded-xl border border-line-subtle bg-surface-main pl-9 pr-8 py-2 text-xs font-semibold text-content-main outline-none focus:border-brand-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-main"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <FilterSelect
            value={selectedCategory}
            onChange={setSelectedCategory}
            ariaLabel="Filter policies by category"
            className="w-full sm:w-auto"
            options={[
              { value: "all", label: "All Categories" },
              { value: "general", label: "General" },
              { value: "conduct", label: "Conduct & Ethics" },
              { value: "attendance", label: "Attendance" },
              { value: "leaves", label: "Leaves" },
              { value: "benefits", label: "Benefits & Perks" },
              { value: "security", label: "IT & Security" },
              { value: "safety", label: "Health & Safety" },
            ]}
          />
        </div>

        {/* Expand / Collapse All Controls */}
        <div className="flex items-center gap-2 text-[11px] font-bold text-content-muted">
          <button
            type="button"
            onClick={() => expandAll(true)}
            className="hover:text-content-main transition cursor-pointer"
          >
            Expand All
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => expandAll(false)}
            className="hover:text-content-main transition cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Policy Sections Accordion List ── */}
      <div className="space-y-3">
        {filteredSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-subtle bg-surface-card p-10 text-center flex flex-col items-center justify-center gap-2">
            <BookOpen className="size-8 text-content-muted" />
            <h3 className="text-sm font-bold text-content-main">No policy clauses found</h3>
            <p className="text-xs text-content-muted">Try clearing your search keyword.</p>
          </div>
        ) : (
          filteredSections.map((section) => {
            const isOpen = Boolean(openSections[section.number]);
            const isRead = Boolean(readSections[section.number]);
            const categoryKey = section.category || "general";
            const priorityKey = section.priority || "standard";

            const catInfo = CATEGORY_STYLES[categoryKey] || CATEGORY_STYLES.general;
            const prioInfo = PRIORITY_BADGES[priorityKey] || PRIORITY_BADGES.standard;

            return (
              <article
                key={`${section.number}-${section.title}`}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden bg-surface-card ${
                  isOpen
                    ? "border-brand-accent/50 shadow-md ring-2 ring-brand-accent/5"
                    : "border-line-subtle hover:border-line-subtle/80 hover:shadow-xs"
                }`}
              >
                {/* ── Clickable Title Row ── */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.number)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-surface-main/50"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-2">
                    {/* Number Badge */}
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold transition-colors ${
                        isRead
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : isOpen
                          ? "bg-brand-accent text-white shadow-xs"
                          : "bg-surface-main text-content-main border border-line-subtle"
                      }`}
                    >
                      {isRead ? <Check className="size-4 stroke-[3]" /> : String(section.number).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-extrabold text-content-main tracking-tight truncate">
                          {section.title}
                        </h2>

                        {/* Category Badge */}
                        <span
                          className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${catInfo.badge}`}
                        >
                          {catInfo.label}
                        </span>

                        {/* Priority Badge */}
                        {priorityKey !== "standard" && (
                          <span
                            className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${prioInfo.badge}`}
                          >
                            {prioInfo.label}
                          </span>
                        )}

                        {/* Mandatory Sign-Off Badge */}
                        {section.requiresAcknowledgement && (
                          <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <ShieldAlert className="size-3" /> Mandatory Sign-Off
                          </span>
                        )}
                      </div>

                      {/* Brief Teaser if collapsed */}
                      {!isOpen && section.summary && (
                        <p className="mt-1 text-xs text-content-muted truncate max-w-xl">
                          {section.summary}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Chevron Arrow */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`size-8 rounded-xl flex items-center justify-center transition-transform duration-300 ${
                        isOpen
                          ? "rotate-180 bg-brand-subtle text-brand-accent"
                          : "bg-surface-main text-content-muted"
                      }`}
                    >
                      <ChevronDown className="size-4" />
                    </span>
                  </div>
                </button>

                {/* ── Height-wise Animated Content Container ── */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-2 border-t border-line-subtle/70 space-y-4">
                      {/* Optional Key Takeaway Callout */}
                      {section.summary && (
                        <div className="flex items-start gap-3 rounded-xl bg-brand-subtle/40 border border-brand-accent/15 p-3.5 text-xs text-content-main">
                          <Sparkles className="size-4 text-brand-accent shrink-0 mt-0.5" />
                          <div>
                            <span className="font-extrabold text-brand-accent block mb-0.5">
                              Key Takeaway
                            </span>
                            <span className="text-content-secondary leading-relaxed">
                              {section.summary}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Full Formatted Clause Content */}
                      <div className="whitespace-pre-line text-xs sm:text-sm leading-6 sm:leading-7 text-content-main font-normal">
                        {section.content}
                      </div>

                      {/* Section Footer: "Mark as Read" acknowledgment */}
                      <div className="flex items-center justify-between pt-3 border-t border-line-subtle/60 text-xs">
                        <span className="text-[11px] text-content-muted font-medium">
                          Clause §{section.number} of Employee HR Policy
                        </span>

                        <button
                          type="button"
                          onClick={(e) => toggleReadStatus(section.number, e)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                            isRead
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-surface-main text-content-secondary border border-line-subtle hover:text-content-main hover:bg-surface-card"
                          }`}
                        >
                          <Check className={`size-3.5 ${isRead ? "stroke-[3]" : ""}`} />
                          <span>{isRead ? "Marked as Understood" : "Mark as Read"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}