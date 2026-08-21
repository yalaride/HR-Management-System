"use client";

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import useSWR from "swr";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/* ── 1. Sidebar Context & Provider ── */
type SidebarContextValue = {
  state: "expanded" | "collapsed";
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode;
  /** Initial state, read server-side from the sidebar_state cookie */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggleSidebar = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        document.cookie = `sidebar_state=${next}; path=/; max-age=${60 * 60 * 24 * 7};`;
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      state: open ? ("expanded" as const) : ("collapsed" as const),
      toggleSidebar,
    }),
    [open, toggleSidebar]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/* ── 2. Navigation Items Configuration ── */
interface SidebarProps {
  role?: "admin" | "employee";
}

const navItems = {
  admin: [
    {
      href: "/admin/dashboard",
      label: "Dashboard",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      href: "/admin/employees",
      label: "Employees",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: "/admin/payslips",
      label: "Payslips",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: "/admin/leaves",
      label: "Leave Manager",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: "/admin/leaves-policy",
      label: "Leaves Policy",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    // Activity (System Activity Logs) — temporarily hidden from the admin
    // sidebar per request. Page/route still exists at /admin/activity;
    // restore by re-adding this entry.
    // {
    //   href: "/admin/activity",
    //   label: "Activity",
    //   icon: (
    //     <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v8z" />
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h6" />
    //     </svg>
    //   ),
    // },
    {
      href: "/admin/employee-attendance",
      label: "Attendance Record",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3 3L22 4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      href: "/admin/birthdays",
      label: "Birthdays",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4 8-10V6l-8-4-8 4v6c0 6 8 10 8 10z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10h.01M15 10h.01" />
        </svg>
      ),
    },
    {
      href: "/admin/settings",
      label: "Settings",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ],
  employee: [
    {
      href: "/employee/dashboard",
      label: "Dashboard",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    
    {
      href: "/employee/attendance",
      label: "Attendance",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: "/employee/leaves-request",
      label: "Leave",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: "/employee/payslip-employee",
      label: "Payslips",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: "/employee/profile",
      label: "Profile Settings",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ],
};

/* Extra items shown only to employees assigned as department head */
const departmentHeadNavItems = [
  {
    href: "/employee/department/attendance",
    label: "Team Attendance",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3 3L22 4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: "/employee/department/leaves",
    label: "Team Leaves",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

/* ── 3. Single Consolidated Brand & User Header Div ── */
function UnifiedHeaderCard({
  displayRole,
  userEmail,
  onCloseMobile,
}: {
  displayRole: string;
  userEmail: string;
  onCloseMobile: () => void;
}) {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className="flex items-center justify-between pb-3 border-b border-line-subtle min-h-12">
      {/* Brand + Email Combined Container */}
      <div
        className={
          isCollapsed
            ? "group/logo relative size-9 shrink-0 cursor-pointer rounded-xl"
            : "flex items-center gap-2.5 min-w-0"
        }
        {...(isCollapsed
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": "Expand sidebar",
              onClick: toggleSidebar,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSidebar();
                }
              },
            }
          : {})}
      >
        {isCollapsed ? (
          <>
            {/* Collapsed State: Logo badge swaps to PanelLeftOpen icon on hover */}
            <div className="size-9 rounded-xl bg-brand-accent flex items-center justify-center font-bold text-white text-xs shadow-xs transition-opacity duration-200 group-hover/logo:opacity-0">
              S
            </div>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/logo:opacity-100">
              <PanelLeftOpen className="h-5 w-5 text-brand-accent" strokeWidth={1.75} />
            </span>
          </>
        ) : (
          /* Expanded State: Clean Logo, Role Badge & Email in One Integrated Section */
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-brand-accent flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
              S
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-content-main tracking-tight leading-tight">
                  SyncUp
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-brand-subtle text-brand-accent uppercase shrink-0">
                  {displayRole}
                </span>
              </div>
              <span className="text-[11px] text-content-muted font-medium truncate mt-0.5 leading-tight">
                {userEmail}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Toggle Button */}
      {!isCollapsed && (
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={toggleSidebar}
          className="hidden lg:flex p-1.5 rounded-lg border border-line-subtle bg-surface-main text-content-secondary hover:text-content-main hover:bg-surface-card transition-colors cursor-pointer shrink-0"
        >
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
        </button>
      )}

      {/* Mobile Drawer Close Button */}
      <button
        type="button"
        onClick={onCloseMobile}
        className="lg:hidden p-1.5 rounded-lg border border-line-subtle text-content-secondary hover:text-content-main hover:bg-surface-main cursor-pointer"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── 4. Main Sidebar Component ── */
export default function Sidebar({ role }: SidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const pathname = usePathname() || "";
  const router = useRouter();
  const { data: session } = useSession();

  // Close menus when the route changes (render-time adjustment instead of an
  // effect, per React guidance — avoids a cascading re-render).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsNavOpen(false);
    setIsProfileOpen(false);
  }

  useEffect(() => {
    if (session?.error === "SessionExpired") {
      signOut({ callbackUrl: "/" });
    }
  }, [session]);

  // Mobile drawer: lock page scroll while open and close on Escape
  useEffect(() => {
    if (!isNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsNavOpen(false);
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNavOpen]);

  const sessionRole = session?.user?.role?.trim().toLowerCase();
  const isAdminFromSession = sessionRole === "admin";
  const isEmployeeFromSession = sessionRole === "employee";

  const fallbackPathRole: "admin" | "employee" = pathname.startsWith("/admin")
    ? "admin"
    : "employee";

  const displayRole: "admin" | "employee" =
    role ||
    (isAdminFromSession ? "admin" : isEmployeeFromSession ? "employee" : null) ||
    fallbackPathRole;

  // Department-head status (server-verified) unlocks the "Team" nav items.
  // Cached via SWR so route changes never re-trigger the request.
  const sessionUserId = session?.user?.id;
  const { data: headStatus } = useSWR<{ isHead?: boolean }>(
    displayRole === "employee" && sessionUserId ? "/api/head/me" : null
  );
  const isDepartmentHead = Boolean(headStatus?.isHead);

  // Full activity feed — only for allowlisted employee emails (server-checked).
  // No admin UI indicates this; failed/403 → canView false.
  const { data: auditAccess } = useSWR<{ canView?: boolean }>(
    displayRole === "employee" && sessionUserId ? "/api/employee/activity?probe=1" : null,
    async (url: string) => {
      const res = await fetch(url);
      if (res.status === 401 || res.status === 403) return { canView: false };
      if (!res.ok) return { canView: false };
      return res.json();
    }
  );
  const canViewAuditLogs = Boolean(auditAccess?.canView);

  const auditLogNavItem = {
    href: "/employee/activity",
    label: "Activity Logs",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2v0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6M9 16h6" />
      </svg>
    ),
  };

  let activeNavItems = [...navItems[displayRole]];
  if (displayRole === "employee" && isDepartmentHead) {
    activeNavItems = [...activeNavItems, ...departmentHeadNavItems];
  }
  if (displayRole === "employee" && canViewAuditLogs) {
    // Insert before Profile Settings
    const profileIdx = activeNavItems.findIndex((item) => item.href === "/employee/profile");
    if (profileIdx >= 0) {
      activeNavItems = [
        ...activeNavItems.slice(0, profileIdx),
        auditLogNavItem,
        ...activeNavItems.slice(profileIdx),
      ];
    } else {
      activeNavItems = [...activeNavItems, auditLogNavItem];
    }
  }

  const defaultProfile =
    displayRole === "admin"
      ? { name: "Admin User", email: "admin@vibeflow.com", avatarLabel: "AD" }
      : { name: "Employee User", email: "employee@vibeflow.com", avatarLabel: "EM" };

  const matchesActiveContext = sessionRole === displayRole;
  const currentProfile = {
    role: displayRole,
    name: matchesActiveContext && session?.user?.name ? session.user.name : defaultProfile.name,
    email: matchesActiveContext && session?.user?.email ? session.user.email : defaultProfile.email,
    avatarLabel: defaultProfile.avatarLabel,
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden w-full bg-surface-card border-b border-line-subtle px-4 py-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open Navigation"
            className="p-2 rounded-xl border border-line-subtle bg-surface-main text-content-secondary hover:text-content-main hover:bg-surface-card transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <span className="font-extrabold text-sm text-content-main tracking-tight">SyncUp</span>
        </div>

        {/* Mobile Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-label="User menu"
            className="w-9 h-9 rounded-xl bg-brand-accent flex items-center justify-center font-bold text-white text-xs shadow-xs ring-2 ring-brand-accent/20 cursor-pointer"
          >
            {currentProfile.avatarLabel}
          </button>

          {isProfileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
              <div className="absolute right-0 mt-2.5 w-56 rounded-2xl bg-surface-card border border-line-subtle shadow-lg z-50 p-2 space-y-1">
                <div className="px-3 py-2 border-b border-line-subtle">
                  <p className="text-xs font-bold text-content-main truncate">{currentProfile.name}</p>
                  <p className="text-[11px] text-content-muted truncate mt-0.5">{currentProfile.email}</p>
                </div>

                <Link
                  href={displayRole === "admin" ? "/admin/settings" : "/employee/profile"}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-content-secondary hover:text-content-main hover:bg-surface-main rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{displayRole === "admin" ? "Settings" : "Profile"}</span>
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    setIsProfileOpen(false);
                    await signOut({ redirect: false });
                    router.push("/");
                    router.refresh();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Log out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isNavOpen && (
        <div
          onClick={() => setIsNavOpen(false)}
          className="fixed inset-0 bg-content-main/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-surface-card border-r border-line-subtle p-3.5 sm:p-4 shadow-lg select-none flex flex-col justify-between transition-all duration-300 ease-in-out lg:static lg:h-screen lg:max-h-screen lg:translate-x-0 ${
          isNavOpen ? "translate-x-0 w-72 max-w-[85vw]" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-18" : "lg:w-60"}`}
      >
        <div className="flex flex-col gap-5 overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Unified Brand + Role + Email Header Div */}
          <UnifiedHeaderCard
            displayRole={displayRole}
            userEmail={currentProfile.email}
            onCloseMobile={() => setIsNavOpen(false)}
          />

          {/* Navigation Items */}
          <div>
            {!isCollapsed && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted px-2 mb-2">
                Navigation
              </div>
            )}

            <nav>
              <ul className="space-y-1.5">
                {activeNavItems.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={isCollapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 ${
                          isCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-brand-accent text-white shadow-xs font-bold"
                            : "text-content-secondary hover:text-content-main hover:bg-surface-main"
                        }`}
                      >
                        <div className="shrink-0">{item.icon}</div>
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>

        {/* Footer Logout Action */}
        <div className="pt-3 border-t border-line-subtle mt-3">
          <button
            type="button"
            title={isCollapsed ? "Log out" : undefined}
            onClick={async () => {
              await signOut({ redirect: false });
              router.push("/");
              router.refresh();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-all duration-150 cursor-pointer overflow-hidden ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span className="truncate">Log out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}