"use client";

import React, { useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import {
  Users,
  Layers,
  CalendarCheck,
  Clock,
  UserPlus,
  FileSpreadsheet,
  Calendar,
  ChevronRight
} from "lucide-react";
import { StatCard } from "@/app/components/admin/StatCard";
import AddEmployeeModal from "@/app/components/admin/employees/AddEmployeeModal";
import Link from "next/link";
import { RecentActivityPanel } from "@/app/components/admin/RecentActivityPanel";
import BirthdayCelebrationsCard from "@/app/components/admin/dashbord/BirthdayCelebrationsCard";
import UpcomingBirthdaysCard, {
  UpcomingBirthday,
} from "@/app/components/admin/dashbord/UpcomingBirthdaysCard";

function getFriendlyErrorMessage(error: string | null): string | null {
  if (!error) return null;
  const lower = error.toLowerCase();
  
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Unable to connect to the server. Please check your network connection and try again.";
  }
  if (lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("401") || lower.includes("403")) {
    return "Your authorization has expired or you do not have permission. Please sign in again.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "The requested information could not be found. Please refresh and try again.";
  }
  if (lower.includes("unique") || lower.includes("already exists") || lower.includes("duplicate")) {
    return "An employee account with this email address is already registered.";
  }
  if (lower.includes("validation") || lower.includes("required") || lower.includes("invalid input")) {
    return "Please verify that all fields are filled out correctly before saving.";
  }
  return "Something went wrong while processing this action. Please try again shortly.";
}

interface TodayBirthday {
  name: string;
  designation?: string;
  department?: string;
  profilePhotoUrl?: string;
  profilePhotoURL?: string;
  profilePicture?: string;
  image?: string;
  picture?: string;
}

// Client-only current date (empty string on the server keeps hydration safe,
// exactly like the previous set-state-on-mount effect).
const subscribeToNothing = () => () => {};
const getClientDate = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const getServerDate = () => "";

interface DashboardStatsResponse {
  totalEmployees: number;
  totalDepartments: number;
  pendingLeaves: number;
  todayAttendancePercent: number;
  presentToday: number;
  todayBirthdays: TodayBirthday[];
  upcomingBirthdays?: UpcomingBirthday[];
}

export default function AdminDashboardPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addEmployeeError, setAddEmployeeError] = useState<string | null>(null);
  const currentDate = useSyncExternalStore(subscribeToNothing, getClientDate, getServerDate);

  // Cached + background-revalidated: revisits render instantly from cache
  const {
    data,
    error,
    isLoading,
    mutate: refreshStats,
  } = useSWR<DashboardStatsResponse>("/api/admin/dashboard");

  const dashboardStats = data ?? null;
  const todayBirthdays = Array.isArray(data?.todayBirthdays) ? data.todayBirthdays : [];
  const upcomingBirthdays = Array.isArray(data?.upcomingBirthdays) ? data.upcomingBirthdays : [];
  const statsLoading = isLoading;
  const statsError = error ? (error instanceof Error ? error.message : "Failed to load dashboard stats") : null;

  const handleCreateEmployee = async (data: {
    name: string;
    email: string;
    password: string;
    department: string;
    status: string;
    designation: string;
    salary: number;
    joinDate: string;
  }) => {
    setAddEmployeeError(null);

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          role: "employee",
        }),
      });

      let serverErrorMsg = "Failed to create profile.";
      if (!res.ok) {
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const result = await res.json();
            serverErrorMsg = result.error || result.message || serverErrorMsg;
          } else {
            const text = await res.text();
            serverErrorMsg = text || serverErrorMsg;
          }
        } catch {}
        throw new Error(serverErrorMsg);
      }

      const result = await res.json();
      if (result?.employee) {
        setIsAddModalOpen(false);
        await refreshStats();
      }
    } catch (err) {
      setAddEmployeeError(err instanceof Error ? err.message : "An error occurred during registration.");
    }
  };

  const stats = [
    {
      label: "Total Employees",
      value: statsLoading ? "—" : String(dashboardStats?.totalEmployees ?? 0),
      change: "+8.4%",
      isPositive: true,
      changeText: "vs last month",
      icon: Users,
      colorClass: "bg-brand-subtle text-brand-accent border-line-subtle",
    },
    {
      label: "Total Departments",
      value: statsLoading ? "—" : String(dashboardStats?.totalDepartments ?? 0),
      change: "Active",
      isPositive: true,
      changeText: "In administration",
      icon: Layers,
      colorClass: "bg-brand-subtle/40 text-brand-hover border-line-subtle/60",
    },
    {
      label: "Today's Attendance",
      value: statsLoading ? "—" : `${dashboardStats?.todayAttendancePercent ?? 0}%`,
      change: "+1.2%",
      isPositive: true,
      changeText: `${dashboardStats?.presentToday ?? 0} present today`,
      icon: CalendarCheck,
      colorClass: "bg-emerald-50/80 text-emerald-700 border-emerald-100/80",
    },
    {
      label: "Pending Leaves",
      value: statsLoading ? "—" : String(dashboardStats?.pendingLeaves ?? 0),
      change: "Action Required",
      isPositive: false,
      changeText: "Requires standard review",
      icon: Clock,
      colorClass: "bg-amber-50/80 text-amber-700 border-amber-100/80",
    },
  ];

  return (
    <div className="min-h-screen bg-surface-main pb-16">
      <div className="px-2 py-6 space-y-6 w-full">
        
        {/* Dashboard Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line-subtle">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-accent animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
                HR Operations Portal
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-content-main tracking-tight mt-1">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-content-secondary">
              Overview and quick actions for real-time employee directory operations.
              {statsError && (
                <span className="block mt-2 text-xs text-amber-600 font-medium">
                  ⚠️ {getFriendlyErrorMessage(statsError)}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs font-bold text-brand-accent shadow-sm">
              <Calendar className="w-4 h-4 text-brand-accent" />
              <span>{currentDate || "Loading Date..."}</span>
            </div>
          </div>
        </div>

        {/* Counter Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <StatCard
              key={idx}
              label={stat.label}
              value={stat.value}
              change={stat.change}
              isPositive={stat.isPositive}
              changeText={stat.changeText}
              icon={stat.icon}
              colorClass={stat.colorClass}
            />
          ))}
        </div>

        {/* Modular Birthday Celebrants Section */}
        <BirthdayCelebrationsCard celebrants={todayBirthdays} />
        <UpcomingBirthdaysCard upcoming={upcomingBirthdays} />

        {/* Secondary Row: Recent Activities & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Activities */}
          <div className="lg:col-span-2 panel p-6 flex flex-col justify-between gap-6 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
                <div>
                  <h2 className="text-base font-semibold text-content-main">Recent System Activity</h2>
                  <p className="text-xs text-content-secondary mt-0.5">Real-time log of administrative events.</p>
                </div>
                <Link href="/admin/activity" className="text-xs font-semibold text-brand-accent hover:text-brand-hover transition cursor-pointer">
                  View All Activity
                </Link>
              </div>

              <div className="mt-2">
                <RecentActivityPanel />
              </div>
            </div>
          </div>

          {/* Quick HR Actions Panel */}
          <div className="lg:col-span-1 panel p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-content-main">Quick Actions</h2>
                <p className="text-xs text-content-secondary mt-0.5">Direct shortcuts to common HR tasks.</p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setAddEmployeeError(null);
                    setIsAddModalOpen(true);
                  }}
                  aria-label="Add New Employee"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-main/60 hover:bg-surface-main border border-line-subtle hover:border-brand-subtle transition-all duration-200 text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-subtle text-brand-accent rounded-lg border border-brand-subtle group-hover:bg-brand-accent group-hover:text-white transition-all duration-200">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-content-main block">Add New Employee</span>
                      <span className="text-[11px] text-content-secondary">Register new directory profiles</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-content-muted group-hover:text-content-secondary group-hover:translate-x-0.5 transition" />
                </button>

                <Link
                  href="/admin/leaves"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-main/60 hover:bg-surface-main border border-line-subtle hover:border-brand-subtle transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 group-hover:bg-amber-500 group-hover:text-white transition-all duration-200">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-content-main block">Manage Leave Requests</span>
                      <span className="text-[11px] text-content-secondary">Approve or deny applications</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-content-muted group-hover:text-content-secondary group-hover:translate-x-0.5 transition" />
                </Link>

                <Link
                  href="/admin/payslips"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-main/60 hover:bg-surface-main border border-line-subtle hover:border-brand-subtle transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-content-main block">Review Salary Payslips</span>
                      <span className="text-[11px] text-content-secondary">Dispatch salary and tax records</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-content-muted group-hover:text-content-secondary group-hover:translate-x-0.5 transition" />
                </Link>
              </div>

              <div className="pt-4 border-t border-line-subtle text-center">
                <span className="text-xs text-content-muted">
                  Need help? Read the{" "}
                  <a href="#" className="text-brand-accent hover:text-brand-hover hover:underline transition">
                    HR Playbook
                  </a>
                </span>
              </div>
            </div>
          </div>
        </div>

        <AddEmployeeModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setAddEmployeeError(null);
          }}
          errorMessage={getFriendlyErrorMessage(addEmployeeError)}
          onSave={handleCreateEmployee}
        />
      </div>
    </div>
  );
}