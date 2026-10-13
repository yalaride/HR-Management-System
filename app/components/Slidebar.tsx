"use client";

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Activity,
  Banknote,
  BookOpen,
  BookOpenCheck,
  Cake,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  CalendarRange,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";

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
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    },
    {
      href: "/admin/employees",
      label: "Employees",
      icon: <Users className="w-5 h-5 shrink-0" />,
    },
    {
      href: "/admin/payslips",
      label: "Payslips",
      icon: <Banknote className="w-5 h-5 shrink-0" />, // Dedicated payroll / salary icon
    },
    {
      href: "/admin/leaves",
      label: "Leave Manager",
      icon: <CalendarCheck className="w-5 h-5 shrink-0" />, // Calendar approval / management
    },
    {
      href: "/admin/leaves-policy",
      label: "Leaves Policy",
      icon: <BookOpenCheck className="w-5 h-5 shrink-0" />, // Policy guidelines & rule checks
    },
    {
      href: "/admin/hr-policies",
      label: "HR Policies",
      icon: <BookOpen className="w-5 h-5 shrink-0" />, // Company policies handbook
    },
    {
      href: "/admin/employee-attendance",
      label: "Attendance Record",
      icon: <CalendarClock className="w-5 h-5 shrink-0" />, // Date + time attendance logs
    },
    {
      href: "/admin/birthdays",
      label: "Birthdays",
      icon: <Cake className="w-5 h-5 shrink-0" />,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      icon: <Settings className="w-5 h-5 shrink-0" />,
    },
  ],
  employee: [
    {
      href: "/employee/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    },
    {
      href: "/employee/attendance",
      label: "Attendance",
      icon: <Clock3 className="w-5 h-5 shrink-0" />, // Clock-in / daily hours
    },
    {
      href: "/employee/leaves-request",
      label: "Leave",
      icon: <CalendarOff className="w-5 h-5 shrink-0" />, // Requesting time off / leave
    },
    {
      href: "/employee/hr-policies",
      label: "HR Policies",
      icon: <BookOpen className="w-5 h-5 shrink-0" />, // Employee handbook
    },
    {
      href: "/employee/payslip-employee",
      label: "Payslips",
      icon: <Wallet className="w-5 h-5 shrink-0" />, // Personal salary & earnings
    },
    {
      href: "/employee/profile",
      label: "Profile Settings",
      icon: <UserCog className="w-5 h-5 shrink-0" />, // Profile configuration
    },
  ],
};

/* Extra items shown only to employees assigned as department head */
const departmentHeadNavItems = [
  {
    href: "/employee/department/attendance",
    label: "Team Attendance",
    icon: <UserCheck className="w-5 h-5 shrink-0" />,
  },
  {
    href: "/employee/department/leaves",
    label: "Team Leaves",
    icon: <CalendarRange className="w-5 h-5 shrink-0" />, // Team scheduled leave range (replaces duplicated Users icon)
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
          /* Expanded State: Logo, Role Badge & Email */
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
        <X className="w-5 h-5" />
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

  // Close menus on route changes
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

  // Department-head status
  const sessionUserId = session?.user?.id;
  const { data: headStatus } = useSWR<{ isHead?: boolean }>(
    displayRole === "employee" && sessionUserId ? "/api/head/me" : null
  );
  const isDepartmentHead = Boolean(headStatus?.isHead);

  // Full activity feed
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
    icon: <Activity className="w-5 h-5 shrink-0" />,
  };

  const attendanceDeskNavItem = {
    href: "/employee/attendance-records",
    label: "Set Attendance",
    icon: <CalendarClock className="w-5 h-5 shrink-0" />,
  };

  let activeNavItems = [...navItems[displayRole]];
  if (displayRole === "employee" && isDepartmentHead) {
    activeNavItems = [...activeNavItems, ...departmentHeadNavItems];
  }
  if (displayRole === "employee" && canViewAuditLogs) {
    const profileIdx = activeNavItems.findIndex((item) => item.href === "/employee/profile");
    if (profileIdx >= 0) {
      activeNavItems = [
        ...activeNavItems.slice(0, profileIdx),
        attendanceDeskNavItem,
        auditLogNavItem,
        ...activeNavItems.slice(profileIdx),
      ];
    } else {
      activeNavItems = [...activeNavItems, attendanceDeskNavItem, auditLogNavItem];
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
            <Menu className="w-5 h-5" />
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
                  {displayRole === "admin" ? (
                    <Settings className="w-4 h-4 text-content-muted" />
                  ) : (
                    <UserCog className="w-4 h-4 text-content-muted" />
                  )}
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
                  <LogOut className="w-4 h-4" />
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
          {/* Unified Brand + Role + Email Header */}
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
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="truncate">Log out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}