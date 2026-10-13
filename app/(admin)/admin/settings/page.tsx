"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import Swal from "sweetalert2";
import { Loader2 } from "lucide-react";

import ChangePasswordSettings from "@/app/components/change-password";
import CompanyInfoSettings from "@/app/components/admin/settings/CompanyInfoSettings";
import DepartmentSettings from "@/app/components/admin/settings/DepartmentSettings";
import AttendanceSettings from "@/app/components/admin/settings/AttendanceSettings";
import PayslipBrandingSettings from "@/app/components/admin/settings/PayslipBrandingSettings";

interface CompanySettingsState {
  companyName: string;
  location: string;
  phone: string;
  email: string;
  standardWorkingHours: number;
  departments: string[];
  shiftStart: string;
  shiftEnd: string;
  gracePeriod: number;
  checkInDisplayBefore: number;
  checkOutDisplayAfter: number;
  autoCheckOut: boolean;
  payslipHeadName: string;
  payslipHeadTitle: string;
  payslipSignatureUrl: string;
  payslipStampUrl: string;
  companyLogoUrl: string;
  companyLogoScale: number;
  companyLogoOffsetX: number;
  companyLogoOffsetY: number;
}

const swalCustomClass = {
  popup: "bg-white rounded-2xl border border-line-subtle shadow-xl font-sans",
  title: "text-sm font-bold text-content-main",
  htmlContainer: "text-xs text-content-secondary",
  confirmButton:
    "px-4.5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-accent hover:bg-brand-hover border-none outline-none cursor-pointer transition",
};

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

export default function AdminSettingsPage() {
  // Shares the "/api/settings/company-settings" cache with the Employees page
  const {
    data,
    error: loadError,
    isLoading: loading,
    mutate: mutateSettings,
  } = useSWR<Partial<CompanySettingsState>>("/api/settings/company-settings");

  const settings = useMemo<CompanySettingsState>(
    () => ({
      companyName: data?.companyName || "",
      location: data?.location || "",
      phone: data?.phone || "",
      email: data?.email || "",
      standardWorkingHours:
        typeof data?.standardWorkingHours === "number" ? data.standardWorkingHours : 160,
      departments: Array.isArray(data?.departments) ? data.departments : [],
      shiftStart: data?.shiftStart || "09:00",
      shiftEnd: data?.shiftEnd || "17:00",
      gracePeriod: typeof data?.gracePeriod === "number" ? data.gracePeriod : 15,
      checkInDisplayBefore:
        typeof data?.checkInDisplayBefore === "number" ? data.checkInDisplayBefore : 30,
      checkOutDisplayAfter:
        typeof data?.checkOutDisplayAfter === "number" ? data.checkOutDisplayAfter : 0,
      autoCheckOut: typeof data?.autoCheckOut === "boolean" ? data.autoCheckOut : false,
      payslipHeadName: data?.payslipHeadName || "",
      payslipHeadTitle: data?.payslipHeadTitle || "Authorized Signatory",
      payslipSignatureUrl: data?.payslipSignatureUrl || "",
      payslipStampUrl: data?.payslipStampUrl || "",
      companyLogoUrl: data?.companyLogoUrl || "",
      companyLogoScale: typeof data?.companyLogoScale === "number" ? data.companyLogoScale : 1,
      companyLogoOffsetX: typeof data?.companyLogoOffsetX === "number" ? data.companyLogoOffsetX : 0,
      companyLogoOffsetY: typeof data?.companyLogoOffsetY === "number" ? data.companyLogoOffsetY : 0,
    }),
    [data]
  );

  const handleUpdateSettings = async (updatedFields: Partial<CompanySettingsState>) => {
    const payload = { ...settings, ...updatedFields };
    try {
      const res = await fetch("/api/settings/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to update details.");
      }

      const updatedData = await res.json();
      // Push the server response straight into the shared cache
      mutateSettings(updatedData, { revalidate: false });

      Toast.fire({
        icon: "success",
        title: "Configuration updated",
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: error instanceof Error ? error.message : "Verify your connection parameters and try again.",
        confirmButtonColor: "#7c3aed",
        customClass: swalCustomClass,
      });
      throw error;
    }
  };

  const handleAddDepartment = async (name: string) => {
    await handleUpdateSettings({
      departments: [...settings.departments, name],
    });
  };

  const handleDeleteDepartment = async (name: string) => {
    const result = await Swal.fire({
      title: "Delete Department?",
      text: `Are you sure you want to delete "${name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      customClass: swalCustomClass,
    });

    if (result.isConfirmed) {
      await handleUpdateSettings({
        departments: settings.departments.filter((d) => d !== name),
      });
    }
  };

  const handleRenameDepartment = async (oldName: string, newName: string) => {
    const res = await fetch("/api/admin/departments/rename", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName, newName }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      departments?: string[];
      error?: string;
    };

    if (!res.ok || !Array.isArray(body.departments)) {
      throw new Error(body.error || "Failed to rename department.");
    }

    mutateSettings(
      (prev) => ({ ...(prev || settings), departments: body.departments }),
      { revalidate: false }
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-3 bg-surface-main">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <span className="text-sm font-semibold text-content-secondary">
          Retrieving configuration parameters...
        </span>
      </div>
    );
  }

  // Inline error (instead of a blocking modal) — background revalidation
  // failures never interrupt the admin mid-edit.
  if (loadError && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-3 bg-surface-main text-center px-4">
        <span className="text-sm font-semibold text-content-secondary">
          Could not retrieve system configurations.
        </span>
        <button
          type="button"
          onClick={() => mutateSettings()}
          className="px-4 py-2 bg-brand-accent hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-main text-content-main antialiased ">
      <div className=" w-full space-y-6 ">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-content-main">System Settings</h1>
          <p className="mt-1 text-xs text-content-secondary">
            Configure company attributes, structural departments, work timing constraints, and account security.
          </p>
        </div>

        <CompanyInfoSettings 
          data={settings} 
          onSave={handleUpdateSettings} 
        />
        <PayslipBrandingSettings
          data={{
            companyLogoUrl: settings.companyLogoUrl,
            companyLogoScale: settings.companyLogoScale,
            companyLogoOffsetX: settings.companyLogoOffsetX,
            companyLogoOffsetY: settings.companyLogoOffsetY,
          }}
          onSave={handleUpdateSettings}
        />
        <AttendanceSettings 
          data={settings} 
          onSave={handleUpdateSettings} 
        />

        <DepartmentSettings 
          departments={settings.departments} 
          onAdd={handleAddDepartment}
          onRename={handleRenameDepartment}
          onDelete={handleDeleteDepartment} 
        />

        <div className="flex justify-start">
          <ChangePasswordSettings role="admin" />
        </div>
      </div>
    </div>
  );
}