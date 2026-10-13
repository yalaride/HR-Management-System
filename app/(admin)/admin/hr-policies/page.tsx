"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
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
  tempId?: string;
  number: number;
  title: string;
  category: PolicyCategory;
  priority: PolicyPriority;
  summary: string;
  content: string;
  order: number;
  published: boolean;
  requiresAcknowledgement: boolean;
}

const CATEGORY_STYLES: Record<PolicyCategory, { label: string; badge: string }> = {
  general: { label: "General", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  attendance: { label: "Attendance", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  conduct: { label: "Conduct & Ethics", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  leaves: { label: "Leaves", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  benefits: { label: "Benefits & Perks", badge: "bg-brand-subtle text-brand-hover border-brand-subtle" },
  security: { label: "IT & Security", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  safety: { label: "Health & Safety", badge: "bg-teal-50 text-teal-700 border-teal-200" },
};

const PRIORITY_BADGES: Record<PolicyPriority, { label: string; badge: string }> = {
  standard: { label: "Standard", badge: "bg-gray-100 text-gray-600 border-gray-200" },
  important: { label: "Important", badge: "bg-amber-50 text-amber-700 border-amber-200 font-semibold" },
  critical: { label: "Critical", badge: "bg-rose-50 text-rose-700 border-rose-200 font-bold" },
};

export default function AdminHRPoliciesPage() {
  const [sections, setSections] = useState<PolicySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);

  // Edit & accordion state tracking by ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [backupSection, setBackupSection] = useState<PolicySection | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const getSectionId = (section: PolicySection) => section._id || section.tempId || "";

  // ── Load Policies ──
  useEffect(() => {
    fetch("/api/admin/hr-policies")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load policy.");
        const loadedSections: PolicySection[] = (data.sections || []).map(
          (sec: PolicySection, idx: number) => ({
            ...sec,
            tempId: sec._id || `temp-${idx}`,
          })
        );
        setSections(loadedSections);
      })
      .catch((error) =>
        setMessage({
          text: error instanceof Error ? error.message : "Failed to load policy.",
          type: "error",
        })
      )
      .finally(() => setLoading(false));
  }, []);

  // ── Core Save Request ──
  const persistPolicy = async (sectionsToSave: PolicySection[]): Promise<boolean> => {
    setMessage(null);
    try {
      const response = await fetch("/api/admin/hr-policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: sectionsToSave.map((sec, i) => ({
            ...sec,
            number: i + 1,
            order: i + 1,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save policy.");

      const updated = (data.sections || sectionsToSave).map((sec: PolicySection, idx: number) => ({
        ...sec,
        tempId: sec._id || `temp-${idx}`,
      }));
      setSections(updated);
      setMessage({ text: "Policy updated successfully.", type: "success" });
      return true;
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Failed to save policy.",
        type: "error",
      });
      return false;
    }
  };

  // ── Add Section ──
  const handleAddSection = () => {
    const tempId = `temp-${Date.now()}`;
    const nextNumber = sections.length + 1;
    const newSection: PolicySection = {
      tempId,
      number: nextNumber,
      order: nextNumber,
      title: `Policy Section ${nextNumber}`,
      category: "general",
      priority: "standard",
      summary: "",
      content: "",
      published: true,
      requiresAcknowledgement: false,
    };

    setSections((prev) => [...prev, newSection]);
    setExpandedMap((prev) => ({ ...prev, [tempId]: true }));
    setEditingId(tempId);
    setBackupSection(null);
    setSearchQuery("");
    setSelectedCategory("all");
  };

  // ── Edit & Cancel Handlers ──
  const handleStartEdit = (section: PolicySection) => {
    const id = getSectionId(section);
    setEditingId(id);
    setBackupSection({ ...section });
    setExpandedMap((prev) => ({ ...prev, [id]: true }));
  };

  const handleCancelEdit = () => {
    if (editingId && backupSection) {
      setSections((prev) =>
        prev.map((s) => (getSectionId(s) === editingId ? backupSection : s))
      );
    }
    setEditingId(null);
    setBackupSection(null);
  };

  // ── Single Section Save ──
  const handleSaveSection = async (section: PolicySection) => {
    const id = getSectionId(section);
    if (!section.title.trim()) {
      setMessage({ text: "Policy title cannot be empty.", type: "error" });
      return;
    }
    if (!section.content.trim()) {
      setMessage({ text: "Policy content cannot be empty.", type: "error" });
      return;
    }

    setSavingSectionId(id);
    const success = await persistPolicy(sections);
    if (success) {
      setEditingId(null);
      setBackupSection(null);
    }
    setSavingSectionId(null);
  };

  // ── Remove Section ──
  const handleRemoveSection = async (id: string) => {
    const section = sections.find((item) => getSectionId(item) === id);
    const result = await Swal.fire({
      title: "Delete Policy Section?",
      html: `<b>${section?.title || "This policy section"}</b> will be permanently removed.<br/>This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete section",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: "bg-white border border-line-subtle rounded-2xl shadow-xl p-6 font-sans text-center",
        title: "text-base font-bold text-content-main",
        htmlContainer: "text-xs text-content-secondary mt-2 leading-relaxed",
        actions: "flex gap-2 justify-center mt-5 w-full",
        confirmButton:
          "px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer",
        cancelButton:
          "px-4 py-2.5 bg-surface-main hover:bg-line-subtle text-content-secondary text-xs font-semibold rounded-xl transition cursor-pointer",
      },
    });

    if (!result.isConfirmed) return;

    const updated = sections
      .filter((s) => getSectionId(s) !== id)
      .map((s, idx) => ({ ...s, number: idx + 1, order: idx + 1 }));

    setSections(updated);
    if (editingId === id) {
      setEditingId(null);
      setBackupSection(null);
    }
    const success = await persistPolicy(updated);
    if (success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Policy section deleted",
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
    }
  };

  // ── Update field helper ──
  const updateSectionField = (id: string, patch: Partial<PolicySection>) => {
    setSections((prev) =>
      prev.map((sec) => (getSectionId(sec) === id ? { ...sec, ...patch } : sec))
    );
  };

  // ── Toggle Accordion ──
  const toggleExpand = (id: string) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Filtered Sections ──
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.summary.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === "all" || s.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [sections, searchQuery, selectedCategory]);

  const totalSections = sections.length;
  const publishedCount = sections.filter((s) => s.published).length;
  const markAsReadCount = sections.filter((s) => s.requiresAcknowledgement).length;

  if (loading) {
    return (
      <div className="min-h-screen space-y-6 pb-12 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded-lg" />
        <div className="h-28 bg-gray-200 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded-2xl" />
          <div className="h-32 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              HR Policy Management
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Manage company policies, guidelines, and mandatory employee sign-offs.
          </p>
        </div>

      </div>

      {/* ── Notification Message ── */}
      {message && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-xs font-semibold shadow-sm transition-all ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="p-1 rounded hover:opacity-70 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Metrics Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-subtle text-brand-accent">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Total Policies
            </div>
            <div className="text-xl font-extrabold text-gray-900">{totalSections}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FileCheck2 className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Active Published
            </div>
            <div className="text-xl font-extrabold text-emerald-600">{publishedCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 leading-snug">
              Mark as Read Required
            </div>
            <div className="text-xl font-extrabold text-indigo-600">{markAsReadCount}</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search policies..."
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs font-medium text-gray-900 outline-none focus:border-brand-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

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

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <span className="text-xs font-medium text-gray-500">
            Showing {filteredSections.length} of {totalSections} sections
          </span>
          <button
            onClick={handleAddSection}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-hover active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Section
          </button>
        </div>
      </div>

      {/* ── Policy Sections ── */}
      <div className="space-y-3.5">
        {filteredSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="size-12 rounded-2xl bg-brand-subtle flex items-center justify-center text-brand-accent">
              <BookOpen className="size-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No sections found</h3>
            <p className="text-xs text-gray-500 max-w-sm">
              Add your first policy section or adjust your search filters.
            </p>
            <button
              onClick={handleAddSection}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-hover transition cursor-pointer"
            >
              <Plus className="size-4" /> Add Section
            </button>
          </div>
        ) : (
          filteredSections.map((section) => {
            const id = getSectionId(section);
            const isEditing = editingId === id;
            const isExpanded = Boolean(expandedMap[id]);
            const isSavingThis = savingSectionId === id;

            const categoryStyle = CATEGORY_STYLES[section.category] || CATEGORY_STYLES.general;
            const priorityBadge = PRIORITY_BADGES[section.priority] || PRIORITY_BADGES.standard;

            return (
              <div
                key={id}
                className={`rounded-2xl border transition-all bg-white shadow-sm ${
                  isEditing
                    ? "border-brand-accent/60 ring-2 ring-brand-subtle"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* ── Card Header ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                  <div
                    onClick={() => !isEditing && toggleExpand(id)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(id);
                      }}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>

                    <span className="flex size-7 items-center justify-center rounded-lg bg-gray-100 text-xs font-extrabold text-gray-700 border border-gray-200 shrink-0">
                      {String(section.number).padStart(2, "0")}
                    </span>

                    <span className="text-sm font-bold text-gray-900 truncate">
                      {section.title || `Section ${section.number}`}
                    </span>

                    {/* Tags */}
                    <span
                      className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${categoryStyle.badge}`}
                    >
                      {categoryStyle.label}
                    </span>

                    <span
                      className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border ${priorityBadge.badge}`}
                    >
                      {priorityBadge.label}
                    </span>

                    {section.requiresAcknowledgement && (
                      <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Mark as Read Required
                      </span>
                    )}

                    <span
                      className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        section.published
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                    >
                      {section.published ? "Published" : "Draft"}
                    </span>
                  </div>

                  {/* Actions: Edit / Save / Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveSection(section)}
                          disabled={isSavingThis}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-brand-hover shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingThis ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Save className="size-3.5" />
                          )}
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(section)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-accent hover:text-brand-accent transition cursor-pointer"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveSection(id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete section"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Card Body (Expanded) ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 sm:p-5 space-y-4">
                    {isEditing ? (
                      /* ── EDIT MODE FORM ── */
                      <div className="space-y-4">
                        {/* Title */}
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                            Policy Title <span className="text-rose-500">*</span>
                          </label>
                          <input
                            value={section.title}
                            onChange={(e) => updateSectionField(id, { title: e.target.value })}
                            placeholder="e.g. Code of Conduct & Workplace Ethics"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-semibold text-gray-900 outline-none focus:bg-white focus:border-brand-accent"
                          />
                        </div>

                        {/* Category, Priority, Published, Mark as Read */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                              Category
                            </label>
                            <FilterSelect
                              value={section.category}
                              onChange={(value) =>
                                updateSectionField(id, { category: value as PolicyCategory })
                              }
                              ariaLabel="Policy category"
                              className="w-full"
                              options={[
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

                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                              Priority
                            </label>
                            <FilterSelect
                              value={section.priority}
                              onChange={(value) =>
                                updateSectionField(id, { priority: value as PolicyPriority })
                              }
                              ariaLabel="Policy priority"
                              className="w-full"
                              options={[
                                { value: "standard", label: "Standard" },
                                { value: "important", label: "Important" },
                                { value: "critical", label: "Critical" },
                              ]}
                            />
                          </div>

                          {/* Published Toggle */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                              Status
                            </label>
                            <button
                              type="button"
                              onClick={() => updateSectionField(id, { published: !section.published })}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                                section.published
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "bg-gray-50 border-gray-200 text-gray-500"
                              }`}
                            >
                              <span>{section.published ? "Published" : "Draft"}</span>
                              <span
                                className={`size-2 rounded-full ${
                                  section.published ? "bg-emerald-500" : "bg-gray-400"
                                }`}
                              />
                            </button>
                          </div>

                          {/* Requires Mark as Read Toggle */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                              Mark as Read Sign-Off
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                updateSectionField(id, {
                                  requiresAcknowledgement: !section.requiresAcknowledgement,
                                })
                              }
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                                section.requiresAcknowledgement
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                  : "bg-gray-50 border-gray-200 text-gray-500"
                              }`}
                            >
                              <span>{section.requiresAcknowledgement ? "Required" : "Optional"}</span>
                              <span
                                className={`size-2 rounded-full ${
                                  section.requiresAcknowledgement ? "bg-indigo-600" : "bg-gray-400"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Summary */}
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                            Summary / Key Takeaway (Optional)
                          </label>
                          <input
                            value={section.summary}
                            onChange={(e) => updateSectionField(id, { summary: e.target.value })}
                            placeholder="Brief 1-sentence synopsis for quick employee reference..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-medium text-gray-800 outline-none focus:bg-white focus:border-brand-accent"
                          />
                        </div>

                        {/* Full Content */}
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                            Detailed Policy Content <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            value={section.content}
                            onChange={(e) => updateSectionField(id, { content: e.target.value })}
                            placeholder="Write comprehensive terms, conditions, rules, and expectations..."
                            rows={6}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-sm leading-6 text-gray-900 outline-none focus:bg-white focus:border-brand-accent"
                          />
                        </div>
                      </div>
                    ) : (
                      /* ── READ VIEW ── */
                      <div className="space-y-3">
                        {section.summary && (
                          <div className="rounded-xl border border-brand-subtle bg-brand-subtle/50 p-3 text-xs font-medium text-brand-hover">
                            <span className="font-bold text-brand-hover">Summary: </span>
                            {section.summary}
                          </div>
                        )}

                        <div className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {section.content || <span className="italic text-gray-400">No content provided yet.</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}