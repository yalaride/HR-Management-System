"use client";

import React from "react";
import useSWR from "swr";
import { CheckSquare, Calendar, FileText, Heart, User } from "lucide-react";

interface Activity {
  _id: string;
  user: string;
  action: string;
  type: string;
  createdAt: string;
}

export function RecentActivityPanel() {
  // Shares the SWR cache with the Activity page — instant on revisit
  const { data, isLoading } = useSWR<{ logs?: Activity[] }>("/api/admin/activity");

  const activities = (data?.logs || []).slice(0, 4);
  const loading = isLoading;

  const getInitials = (name: string) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "U";
  };

  const getActivityConfig = (type: string) => {
    switch (type) {
      case "attendance":
        return {
          indicator: "bg-emerald-500",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
          icon: CheckSquare,
        };
      case "leave":
        return {
          indicator: "bg-amber-500",
          badge: "bg-amber-50 text-amber-700 border-amber-100",
          icon: Calendar,
        };
      case "payslip":
        return {
          indicator: "bg-brand-accent",
          badge: "bg-brand-subtle text-brand-hover border-brand-subtle",
          icon: FileText,
        };
      case "birthday":
        return {
          indicator: "bg-pink-500",
          badge: "bg-pink-50 text-pink-700 border-pink-100",
          icon: Heart,
        };
      default:
        return {
          indicator: "bg-slate-400",
          badge: "bg-slate-50 text-slate-700 border-slate-100",
          icon: User,
        };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="divide-y divide-slate-100">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="py-4 flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              <div className="h-2.5 bg-slate-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-400">
        No recent activities found in logs.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {activities.map((act) => {
        const config = getActivityConfig(act.type);
        return (
          <div
            key={act._id}
            className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm animate-fade-in"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Initials Badge */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${config.badge}`}>
                {getInitials(act.user)}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="font-semibold text-slate-900">{act.user}</span>
                <span className="text-slate-500 text-xs sm:text-sm">{act.action}</span>
              </div>
            </div>

<div className="flex items-center gap-2 shrink-0 pl-0">
              <span className={`w-1.5 h-1.5 rounded-full ${config.indicator}`} />
              <span className="text-xs text-slate-400 font-medium">{formatTimeAgo(act.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}