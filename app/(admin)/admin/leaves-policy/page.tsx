"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Edit2, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Settings2,
  X,
} from "lucide-react";
import ManageLeavePolicyModal from "@/app/components/admin/leave-policy/ManageLeavePolicyModal";

interface EmployeePolicy {
  userId: string;
  name: string;
  email: string;
  profilePhotoUrl?: string;
  designation?: string;
  isCustom: boolean;
  policy: {
    ANNUAL: number;
    SICK: number;
    CASUAL: number;
  };
}

interface GlobalPolicy {
  year: number;
  ANNUAL: number;
  SICK: number;
  CASUAL: number;
}

export default function AdminLeavesPolicyPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeePolicy[]>([]);
  const [banner, setBanner] = useState<{ status: "success" | "error"; message: string } | null>(null);

  // Global Default Policy State (Applied to all baseline employees)
  const [globalPolicy, setGlobalPolicy] = useState<GlobalPolicy>({
    year: new Date().getFullYear(),
    ANNUAL: 15,
    SICK: 8,
    CASUAL: 6,
  });

  // Modal Control States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePolicy | null>(null);

  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);
  const [globalForm, setGlobalForm] = useState<GlobalPolicy>(globalPolicy);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);

  const showBanner = (status: "success" | "error", message: string) => {
    setBanner({ status, message });
    setTimeout(() => setBanner(null), 8000);
  };

  // Load baseline employee list & global policy on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setInitialLoading(true);

        // Fetch employee overrides & global baseline policy in parallel
        const [empRes, globalRes] = await Promise.all([
          fetch("/api/admin/leaves-policy"),
          fetch("/api/admin/leaves-policy/global").catch(() => null),
        ]);

        const empData = await empRes.json().catch(() => ({}));

        if (empRes.ok) {
          setEmployees(Array.isArray(empData) ? empData : empData.employees || []);
        } else {
          showBanner("error", empData.error || empData.details || "Could not fetch employee configurations.");
        }

        if (globalRes && globalRes.ok) {
          const globalData = await globalRes.json().catch(() => null);
          if (globalData?.policy) {
            setGlobalPolicy(globalData.policy);
            setGlobalForm(globalData.policy);
          }
        }
      } catch (err) {
        console.error("Failed to load list.", err);
        showBanner("error", "Network issue encountered while loading configurations.");
      } finally {
        setInitialLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const handleOpenCreateModal = () => {
    setSelectedEmployee(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: EmployeePolicy) => {
    setSelectedEmployee(emp);
    setIsModalOpen(true);
  };

  // Save custom override for an individual employee
  const handleSavePolicy = async (
    userId: string,
    policyData: { ANNUAL: number; SICK: number; CASUAL: number }
  ) => {
    const res = await fetch("/api/admin/leaves-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...policyData }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.details || "Failed to customize employee configuration.");
    }

    const updatedEmployees = employees.map((item) =>
      item.userId === userId
        ? {
            ...item,
            isCustom: true,
            policy: { ...policyData },
          }
        : item
    );
    setEmployees(updatedEmployees);
  };

  // Revert user to the organization's Global Default
  const handleResetToDefault = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to revert ${name} to the standard company baseline?`)) return;

    try {
      const res = await fetch(`/api/admin/leaves-policy?userId=${userId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showBanner("success", `Reverted ${name}'s parameters back to global default.`);

        const resetEmployees = employees.map((item) =>
          item.userId === userId
            ? {
                ...item,
                isCustom: false,
                policy: { ...globalPolicy },
              }
            : item
        );
        setEmployees(resetEmployees);
      } else {
        showBanner("error", data.error || data.details || "Failed to revert user parameters.");
      }
    } catch (err) {
      console.error(err);
      showBanner("error", "Error resetting employee parameters.");
    }
  };

  // Save Global Leave Policy (Applied to ALL non-override employees)
  const handleSaveGlobalPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGlobal(true);
    try {
      const res = await fetch("/api/admin/leaves-policy/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(globalForm),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update global leave policy.");

      setGlobalPolicy(globalForm);
      setIsGlobalModalOpen(false);
      showBanner("success", "Global company leave policy updated successfully.");

      // Update in-memory employees who do not have custom overrides
      setEmployees((prev) =>
        prev.map((emp) =>
          !emp.isCustom
            ? {
                ...emp,
                policy: {
                  ANNUAL: globalForm.ANNUAL,
                  SICK: globalForm.SICK,
                  CASUAL: globalForm.CASUAL,
                },
              }
            : emp
        )
      );
    } catch (err: unknown) {
      showBanner("error", err instanceof Error ? err.message : "Failed to save global policy.");
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const customOverrideEmployees = employees.filter((emp) => emp.isCustom);
  const standardBaselineCount = employees.length - customOverrideEmployees.length;
  const globalTotalPool = globalPolicy.ANNUAL + globalPolicy.SICK + globalPolicy.CASUAL;

  return (
    <div className="space-y-6 max-w-375 mx-auto min-h-screen pb-12">
      {/* Header Info */}
      <div className="flex flex-col gap-4 border-b border-line-subtle pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-content-main tracking-tight font-sans sm:text-2xl">
            Manage Leaves Policy
          </h1>
          <p className="mt-1 text-xs font-medium text-content-muted">
            Set global standard leave allocations for all staff and configure individual overrides.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            onClick={() => {
              setGlobalForm(globalPolicy);
              setIsGlobalModalOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-hover cursor-pointer sm:w-auto"
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            Edit Global Policy
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-hover cursor-pointer sm:w-auto"
          >
            Create Policy Override
          </button>
        </div>
      </div>

      {/* Main Banner Message */}
      {banner && (
        <div
          className={`flex items-start gap-2.5 p-4 rounded-xl text-xs font-semibold border transition-all ${
            banner.status === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}
        >
          {banner.status === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="block font-bold font-sans">
              {banner.status === "success" ? "Operation Successful" : "Notification"}
            </span>
            <span className="block mt-0.5 font-medium leading-relaxed font-sans">{banner.message}</span>
          </div>
        </div>
      )}

      {/* GLOBAL DEFAULT POLICY PANEL */}
      <div className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-line-subtle pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent text-white shadow-sm">
              <Globe className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-content-main">
                  Company-Wide Standard Leave Policy
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-subtle text-brand-accent">
                  Year {globalPolicy.year}
                </span>
              </div>
              <p className="text-[11px] text-content-muted mt-0.5">
                Automatically applied to all {standardBaselineCount} standard employees without custom overrides.
              </p>
            </div>
          </div>

        </div>

        {/* Global Policy Numbers Grid */}
        <div className="grid grid-cols-1 gap-3 pt-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <div className="p-3 bg-white rounded-xl border border-line-subtle shadow-2xs">
            <span className="text-[10px] font-bold text-content-muted uppercase">Annual Leave</span>
            <div className="text-lg font-mono font-extrabold text-brand-accent mt-1">
              {globalPolicy.ANNUAL} <span className="text-xs font-sans text-gray-400 font-medium">days</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-line-subtle shadow-2xs">
            <span className="text-[10px] font-bold text-content-muted uppercase">Sick Leave</span>
            <div className="text-lg font-mono font-extrabold text-rose-700 mt-1">
              {globalPolicy.SICK} <span className="text-xs font-sans text-gray-400 font-medium">days</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-line-subtle shadow-2xs">
            <span className="text-[10px] font-bold text-content-muted uppercase">Casual Leave</span>
            <div className="text-lg font-mono font-extrabold text-amber-700 mt-1">
              {globalPolicy.CASUAL} <span className="text-xs font-sans text-gray-400 font-medium">days</span>
            </div>
          </div>

          <div className="rounded-xl bg-brand-accent p-3 text-white shadow-2xs min-[480px]:col-span-2 xl:col-span-1">
            <span className="text-[10px] font-bold text-white/80 uppercase">Total Annual Pool</span>
            <div className="text-lg font-mono font-extrabold mt-1">
              {globalTotalPool} <span className="text-xs font-sans text-white/80 font-medium">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary Grid */}
      {!initialLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="panel panel-section flex items-center justify-between">
            <div>
              <p className="field-label">Total Staff Monitored</p>
              <h3 className="text-xl font-extrabold mt-1 text-content-main">{employees.length}</h3>
            </div>
            <div className="p-2.5 bg-gray-100 rounded-xl text-gray-500">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>

          <div className="panel panel-section flex items-center justify-between">
            <div>
              <p className="field-label">Active Overrides</p>
              <h3 className="text-xl font-extrabold mt-1 text-brand-accent">
                {customOverrideEmployees.length}
              </h3>
            </div>
            <div className="p-2.5 bg-brand-subtle rounded-xl text-brand-accent">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>

          <div className="panel panel-section flex items-center justify-between">
            <div>
              <p className="field-label font-bold">Standard Baseline Users</p>
              <h3 className="text-xl font-extrabold mt-1 text-emerald-700">{standardBaselineCount}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <RotateCcw className="w-4.5 h-4.5" />
            </div>
          </div>
        </div>
      )}

      {/* Overrides Table Section */}
      {initialLoading ? (
        <div className="text-center py-12 text-xs text-content-muted font-semibold">
          Loading active configurations...
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-extrabold text-content-main uppercase tracking-wider">
                Active Custom Overrides
              </h2>
              <p className="text-[10px] text-content-muted font-medium mt-0.5">
                Staff members with specific quotas diverging from the default {globalTotalPool}-day pool.
              </p>
            </div>
          </div>

          <div className="table-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="table-head">
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500">Custom Employee</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 text-center">Status</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 text-center">Annual Leave</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 text-center">Sick Leave</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 text-center">Casual Leave</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 text-center hidden md:table-cell">
                      Total Annual Pool
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e0e8]/60 font-medium">
                  {customOverrideEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-xs text-gray-400 font-medium">
                        <div className="max-w-xs mx-auto space-y-1.5">
                          <span className="block font-bold text-[#181124]">
                            No Active Overrides Found
                          </span>
                          <span className="block text-[10px] leading-relaxed">
                            All employees are automatically using the company standard baseline policy.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    customOverrideEmployees.map((emp) => {
                      const totalPool = emp.policy.ANNUAL + emp.policy.SICK + emp.policy.CASUAL;

                      return (
                        <tr
                          key={emp.userId}
                          className="table-row-hover transition duration-150"
                        >
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-surface-main text-content-secondary border border-line-subtle flex items-center justify-center overflow-hidden shrink-0 relative">
                                {emp.name
                                  ? emp.name
                                      .split(" ")
                                      .filter(Boolean)
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()
                                  : "??"}
                                {emp.profilePhotoUrl ? (
                                  <img
                                    src={emp.profilePhotoUrl}
                                    alt={emp.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : null}
                              </div>
                              <div>
                                <div className="font-bold text-xs text-[#181124] capitalize">{emp.name}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">{emp.email}</div>
                                {emp.designation && (
                                  <div className="text-[10px] text-gray-500 mt-0.5">{emp.designation}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="table-cell text-center">
                            <span className="status-pill bg-brand-subtle text-brand-accent border-brand-accent/20">
                              Custom
                            </span>
                          </td>

                          <td className="table-cell text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-brand-subtle text-brand-accent font-mono font-bold text-[11px] border border-brand-accent/20 min-w-[54px]">
                              {emp.policy.ANNUAL} d
                            </span>
                          </td>

                          <td className="table-cell text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-rose-50 text-rose-700 font-mono font-bold text-[11px] border border-rose-100 min-w-[54px]">
                              {emp.policy.SICK} d
                            </span>
                          </td>

                          <td className="table-cell text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-mono font-bold text-[11px] border border-amber-100 min-w-[54px]">
                              {emp.policy.CASUAL} d
                            </span>
                          </td>

                          <td className="table-cell text-center font-mono font-bold text-xs text-content-main hidden md:table-cell">
                            <div className="text-xs font-extrabold text-content-main">{totalPool} Days</div>
                            <div className="text-[9px] text-content-muted font-medium">Accumulative</div>
                          </td>

                          <td className="table-cell text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(emp)}
                                className="p-1.5 rounded-xl icon-button hover:text-brand-accent hover:border-brand-accent/35 hover:bg-brand-subtle"
                                title="Edit override settings"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResetToDefault(emp.userId, emp.name)}
                                className="p-1.5 rounded-xl icon-button hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                                title="Revert to standard default policy"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Global Default Policy Settings Modal */}
      {isGlobalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Click backdrop to close */}
          <div
            className="absolute inset-0 bg-content-main/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsGlobalModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-surface-card border border-line-subtle rounded-2xl w-full max-w-md shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Brand accent line at the top */}
            <div className="absolute top-0 inset-x-0 h-1 bg-brand-accent rounded-t-2xl" />

            <div className="px-6 py-4 border-b border-line-subtle flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-content-main">Configure Global Leave Policy</h3>
                <p className="text-xs text-content-muted mt-0.5">
                  Applies to all staff members without custom overrides.
                </p>
              </div>
              <button
                onClick={() => setIsGlobalModalOpen(false)}
                className="p-1.5 rounded-lg text-content-muted hover:text-brand-accent hover:bg-brand-subtle transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGlobalPolicy} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                    Annual Leave (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={globalForm.ANNUAL}
                    onChange={(e) => setGlobalForm({ ...globalForm, ANNUAL: Number(e.target.value) })}
                    className="form-input text-xs font-semibold cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                    Sick Leave (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={globalForm.SICK}
                    onChange={(e) => setGlobalForm({ ...globalForm, SICK: Number(e.target.value) })}
                    className="form-input text-xs font-semibold cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">
                    Casual Leave (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={globalForm.CASUAL}
                    onChange={(e) => setGlobalForm({ ...globalForm, CASUAL: Number(e.target.value) })}
                    className="form-input text-xs font-semibold cursor-pointer"
                  />
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="p-3 bg-surface-main/60 border border-line-subtle rounded-xl flex items-center justify-between text-xs font-medium text-content-muted">
                <span>Total Annual Pool (Annual + Sick + Casual):</span>
                <span className="font-extrabold text-content-main font-mono text-sm">
                  {globalForm.ANNUAL + globalForm.SICK + globalForm.CASUAL} Days
                </span>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-line-subtle">
                <button
                  type="button"
                  onClick={() => setIsGlobalModalOpen(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-content-secondary bg-surface-main hover:bg-brand-subtle hover:text-brand-accent rounded-xl border border-line-subtle transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingGlobal}
                  className="px-4.5 py-2.5 text-xs font-bold text-white bg-brand-accent hover:bg-brand-hover rounded-xl shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
                >
                  {isSavingGlobal ? "Saving..." : "Save Global Baseline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Employee Override Modal */}
      <ManageLeavePolicyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEmployee(null);
        }}
        employees={employees}
        selectedEmployee={selectedEmployee}
        onSave={handleSavePolicy}
      />
    </div>
  );
}