"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { Search, Filter, Calendar, RefreshCw, CheckSquare, User, ChevronDown, AlertTriangle } from "lucide-react";

interface Activity {
  _id: string;
  user: string;
  designation?: string;
  action: string;
  type: string;
  createdAt: string;
}

function ActivityLogPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const typeRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  // Debounce search typing before it becomes part of the SWR key
  useEffect(() => {
    const delayDebounce = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  const params = new URLSearchParams();
  if (typeFilter !== "all") params.append("type", typeFilter);
  if (debouncedSearch) params.append("search", debouncedSearch);
  const queryString = params.toString();

  // Each filter combination is cached; switching back is instant
  const { data, isLoading, mutate: refreshLogs } = useSWR<{ logs?: Activity[] }>(
    `/api/admin/activity${queryString ? `?${queryString}` : ""}`
  );

  const logs = useMemo(() => {
    let fetchedLogs = data?.logs || [];

    if (typeFilter !== "all") {
      fetchedLogs = fetchedLogs.filter((log) => log.type === typeFilter);
    }

    if (dateFilter !== "all") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      fetchedLogs = fetchedLogs.filter((log) => {
        const logDate = new Date(log.createdAt);
        if (dateFilter === "today") {
          return logDate >= startOfToday;
        } else if (dateFilter === "week") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return logDate >= sevenDaysAgo;
        } else if (dateFilter === "month") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return logDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    return fetchedLogs;
  }, [data, typeFilter, dateFilter]);

  const loading = isLoading;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (typeRef.current && !typeRef.current.contains(target)) {
        setIsTypeOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(target)) {
        setIsDateOpen(false);
      }
    }

    if (isTypeOpen || isDateOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTypeOpen, isDateOpen]);

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getActivityConfig = (type: string) => {
    switch (type) {
      case "attendance":
        return {
          icon: CheckSquare,
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
          label: "Attendance",
        };
      case "leave":
        return {
          icon: Calendar,
          badge: "bg-amber-50 text-amber-700 border-amber-200",
          label: "Leave Request",
        };
      case "error":
        return {
          icon: AlertTriangle,
          badge: "bg-rose-50 text-rose-700 border-rose-200",
          label: "Issue",
        };
      default:
        return {
          icon: User,
          badge: "bg-brand-subtle text-brand-accent border-brand-subtle",
          label: type === "birthday" ? "Birthday Mail" : "System",
        };
    }
  };

  const getTypeLabel = (val: string) => {
    switch (val) {
      case "attendance":
        return "Attendance";
      case "leave":
        return "Leaves";
      case "birthday":
        return "Birthdays";
      case "error":
        return "Issues";
      default:
        return "All Types";
    }
  };

  const getDateLabel = (val: string) => {
    switch (val) {
      case "today":
        return "Today";
      case "week":
        return "Last 7 Days";
      case "month":
        return "Last 30 Days";
      default:
        return "All History";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Navigation Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-line-subtle">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-content-main flex items-center gap-2.5">
            System Activity Logs
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-accent"></span>
            </span>
          </h1>
          <p className="text-xs text-content-secondary mt-1 leading-relaxed">
            Real-time administrative feed tracking attendance records, leave queries, and core system logs.
          </p>
        </div>

        <button
          onClick={() => refreshLogs()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-card hover:bg-surface-main border border-line-subtle rounded-xl text-xs font-bold text-content-secondary hover:text-content-main hover:border-brand-accent shadow-xs transition duration-150 active:scale-95 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
        </button>
      </div>

      {/* Filter Controls Panel */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line-subtle bg-surface-card p-4 shadow-xs sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search Input */}
        <div className="relative w-full min-w-[14rem] flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee name or log keyword..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-main border border-line-subtle rounded-xl text-xs text-content-main placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition shadow-xs"
          />
        </div>

        {/* Dropdowns Group */}
        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          {/* Type Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto relative" ref={typeRef}>
            <span className="text-xs font-semibold text-content-secondary flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-brand-accent" /> Filter:
            </span>
            <div className="relative w-full sm:w-44">
              <button
                type="button"
                onClick={() => {
                  setIsTypeOpen(!isTypeOpen);
                  setIsDateOpen(false);
                }}
                className="w-full px-3.5 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs font-bold text-content-main flex items-center justify-between cursor-pointer hover:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition shadow-xs"
              >
                <span className="truncate">{getTypeLabel(typeFilter)}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 shrink-0 ${
                    isTypeOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isTypeOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-surface-card border border-line-subtle rounded-xl shadow-lg py-1 z-50">
                  {[
                    { value: "all", label: "All Types" },
                    { value: "attendance", label: "Attendance" },
                    { value: "leave", label: "Leaves" },
                    { value: "birthday", label: "Birthdays" },
                    { value: "error", label: "Issues" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setTypeFilter(opt.value);
                        setIsTypeOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                        typeFilter === opt.value
                          ? "bg-brand-subtle text-brand-accent font-bold"
                          : "text-content-secondary hover:bg-surface-main hover:text-content-main"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto relative" ref={dateRef}>
            <span className="text-xs font-semibold text-content-secondary flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-brand-accent" /> Range:
            </span>
            <div className="relative w-full sm:w-44">
              <button
                type="button"
                onClick={() => {
                  setIsDateOpen(!isDateOpen);
                  setIsTypeOpen(false);
                }}
                className="w-full px-3.5 py-2.5 bg-surface-card border border-line-subtle rounded-xl text-xs font-bold text-content-main flex items-center justify-between cursor-pointer hover:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition shadow-xs"
              >
                <span className="truncate">{getDateLabel(dateFilter)}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 shrink-0 ${
                    isDateOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDateOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-surface-card border border-line-subtle rounded-xl shadow-lg py-1 z-50">
                  {[
                    { value: "all", label: "All History" },
                    { value: "today", label: "Today" },
                    { value: "week", label: "Last 7 Days" },
                    { value: "month", label: "Last 30 Days" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDateFilter(opt.value);
                        setIsDateOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                        dateFilter === opt.value
                          ? "bg-brand-subtle text-brand-accent font-bold"
                          : "text-content-secondary hover:bg-surface-main hover:text-content-main"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Activity List Container */}
      <div className="bg-surface-card border border-line-subtle rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <span className="w-8 h-8 border-3 border-line-subtle border-t-brand-accent rounded-full animate-spin" />
            <p className="text-xs text-content-secondary font-medium">Querying organizational feed...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center px-4">
            <p className="text-sm font-semibold text-content-main">No matching logs found.</p>
            <p className="text-xs text-content-muted mt-1">
              Try resetting selected parameters or search input.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {logs.map((log) => {
              const config = getActivityConfig(log.type);
              const Icon = config.icon;
              return (
                <div
                  key={log._id}
                  className="p-4 sm:px-6 hover:bg-surface-main/60 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border select-none ${config.badge}`}
                    >
                      {getInitials(log.user)}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-content-main text-sm tracking-tight truncate">
                          {log.user}
                        </span>
                        {log.designation && (
                          <span className="text-[10px] font-extrabold bg-brand-subtle text-brand-accent px-2 py-0.5 rounded-md border border-brand-accent/10 tracking-wide uppercase">
                            {log.designation}
                          </span>
                        )}
                        <span className="text-content-secondary text-xs sm:text-sm font-medium">
                          {log.action}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border tracking-wider uppercase ${config.badge}`}
                        >
                          <Icon className="w-3 h-3" /> {config.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 border-t sm:border-0 border-line-subtle pt-2 sm:pt-0">
                    <span className="text-xs font-bold text-content-secondary">
                      {formatDate(log.createdAt)}
                    </span>
                    <span className="text-[10px] text-content-muted font-semibold">
                      {formatTime(log.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityLogPage;