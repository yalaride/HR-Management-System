"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Swal from "sweetalert2";
import EmployeeTable, { Employee } from "../../../components/admin/employees/EmployeeTable";

import AddEmployeeModal from "../../../components/admin/employees/AddEmployeeModal";
import EditEmployeeModal from "../../../components/admin/employees/EditEmployeeModal";
import ViewEmployeeModal from "../../../components/admin/employees/ViewEmployeeModal";
import EmptyState from "../../../components/admin/employees/EmptyState";
import { FilterSelect } from "@/app/components/ui/FilterSelect";
import {
  Building2,
  Briefcase,
  X,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { EmployeeUpdatePayload } from "../../../components/admin/employees/EmployeeTable";

/**
 * Translates raw backend errors into clear user-friendly messages
 * while preserving specific actionable business rule messages.
 */
function getFriendlyErrorMessage(error: string | null): string | null {
  if (!error) return null;

  const lower = error.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Unable to connect to the server. Please check your network connection and try again.";
  }
  if (
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "Your authorization has expired or you do not have permission. Please sign in again.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "The requested information could not be found. Please refresh and try again.";
  }
  if (
    lower.includes("already in use") ||
    lower.includes("already exists") ||
    lower.includes("duplicate") ||
    lower.includes("e11000")
  ) {
    return "An employee account with this email address is already registered.";
  }

  // Preserve meaningful business errors directly
  if (
    lower.includes("cannot be assigned") ||
    lower.includes("already ended") ||
    lower.includes("cannot be set as permanent") ||
    lower.includes("cannot be in the future") ||
    lower.includes("duration must be") ||
    lower.includes("salary must be")
  ) {
    return error;
  }

  if (
    lower.includes("validation") ||
    lower.includes("required") ||
    lower.includes("invalid input")
  ) {
    return "Please verify that all fields are filled out correctly before saving.";
  }

  // Return the error message directly if it is human-readable, otherwise friendly fallback
  return error.length < 160
    ? error
    : "Something went wrong while processing this action. Please try again shortly.";
}

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "All", label: "All Types" },
  { value: "Probation", label: "Probation" },
  { value: "Internship", label: "Internship" },
  { value: "Permanent", label: "Permanent" },
  { value: "Contract", label: "Contract" },
];

export default function AdminEmployeesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("All");
  const [onlyDueReviews, setOnlyDueReviews] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Modal triggers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Selected employee data
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Local state containers for errors
  const [addEmployeeError, setAddEmployeeError] = useState<string | null>(null);
  const [editEmployeeError, setEditEmployeeError] = useState<string | null>(null);

  // Fetch employees & departments
  const {
    data: employeesData,
    error: employeesError,
    isLoading,
    mutate: mutateEmployees,
  } = useSWR<Employee[]>("/api/admin/employees");

  const { data: settingsData } = useSWR<{ departments?: string[] }>(
    "/api/settings/company-settings"
  );

  const employees = useMemo(() => employeesData ?? [], [employeesData]);
  const departments = useMemo(
    () => (Array.isArray(settingsData?.departments) ? settingsData.departments : []),
    [settingsData]
  );

  const dueReviewEmployees = useMemo(() => {
    return employees.filter((emp) => emp.reviewStatus === "Due Review");
  }, [employees]);

  const error = employeesError
    ? employeesError instanceof Error
      ? employeesError.message
      : "An unexpected error occurred."
    : null;

  // CREATE profile handler: returns true on success, false on failure
  const handleCreateEmployee = async (
    data: Omit<Employee, "id" | "role"> & {
      password?: string;
      designation?: string;
      joinDate?: string;
      role?: "employee" | "admin";
      salary: number;
      department: string;
      status: string;
      employmentType: string;
      durationMonths: number;
    }
  ): Promise<boolean> => {
    setAddEmployeeError(null);
    try {
      const payload = {
        role: "employee",
        ...data,
      };

      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      if (result.employee) {
        mutateEmployees((prev) => [result.employee, ...(prev ?? [])], { revalidate: false });
        setAddEmployeeError(null);
        setIsAddModalOpen(false);

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Employee created successfully",
          showConfirmButton: false,
          timer: 2500,
          timerProgressBar: true,
        });

        return true;
      }
      return false;
    } catch (err) {
      setAddEmployeeError(
        err instanceof Error ? err.message : "An error occurred during registration."
      );
      return false;
    }
  };

  // EDIT profile handler
  const handleEditEmployee = async (id: string | number, updatedData: EmployeeUpdatePayload) => {
    setEditEmployeeError(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      let serverErrorMsg = "Failed to edit profile.";
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
      if (result.employee) {
        mutateEmployees(
          (prev) => (prev ?? []).map((emp) => (emp.id === id ? result.employee : emp)),
          { revalidate: false }
        );
        setEditEmployeeError(null);
        setIsEditModalOpen(false);
        setSelectedEmployee(null);
      }
    } catch (err) {
      setEditEmployeeError(err instanceof Error ? err.message : "Could not update user info.");
      throw err;
    }
  };

  // DELETE profile handler
  const handleDeleteEmployee = async (id: string | number) => {
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete employee profile");

      mutateEmployees((prev) => (prev ?? []).filter((emp) => emp.id !== id), {
        revalidate: false,
      });
      setIsViewModalOpen(false);
      setSelectedEmployee(null);
    } catch (err) {
      console.error("Delete employee failed:", err);
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: getFriendlyErrorMessage(err instanceof Error ? err.message : null) ?? undefined,
        confirmButtonColor: "#7c3aed",
      });
    }
  };

  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | number | null>(null);

  const handleTableDelete = async (emp: Employee) => {
    const result = await Swal.fire({
      title: "Delete Employee?",
      html: `<b>${emp.name}</b> will be permanently removed along with their login credentials.<br/>This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete employee",
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

    setDeletingEmployeeId(emp.id);
    try {
      await handleDeleteEmployee(emp.id);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Employee deleted",
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditEmployeeError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenView = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsViewModalOpen(true);
  };

  const departmentOptions = useMemo(() => {
    const fromEmployees = employees
      .map((emp) => emp.department)
      .filter((dept): dept is string => Boolean(dept?.trim()));
    const unique = Array.from(new Set([...departments, ...fromEmployees])).sort((a, b) =>
      a.localeCompare(b)
    );

    return [
      { value: "All", label: "All Departments" },
      ...unique.map((dept) => ({ value: dept, label: dept })),
    ];
  }, [departments, employees]);

  // Combined Filters
  const filteredEmployees = employees.filter((emp) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      emp.name?.toLowerCase().includes(query) ||
      emp.role?.toLowerCase().includes(query) ||
      emp.department?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query);

    const matchesDepartment =
      departmentFilter === "All" || emp.department === departmentFilter;

    const matchesType =
      employmentTypeFilter === "All" ||
      emp.employmentType === employmentTypeFilter;

    const matchesDueOnly = !onlyDueReviews || emp.reviewStatus === "Due Review";

    return matchesSearch && matchesDepartment && matchesType && matchesDueOnly;
  });

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    departmentFilter !== "All" ||
    employmentTypeFilter !== "All" ||
    onlyDueReviews;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. NOTIFY BANNER: Due Reviews */}
      {dueReviewEmployees.length > 0 && !isBannerDismissed && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/80 bg-linear-to-r from-amber-50 via-amber-50/70 to-orange-50/50 p-4 sm:p-5 shadow-xs transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Clock className="w-5 h-5 animate-pulse text-amber-600" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-amber-950">
                    Action Required: {dueReviewEmployees.length} Employee
                    {dueReviewEmployees.length > 1 ? "s" : ""} Due for Review
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wider">
                    Period Completed
                  </span>
                </div>

                <p className="text-xs text-amber-800/90 leading-relaxed max-w-2xl">
                  Probation or internship terms have completed. Click an employee to open their
                  review dialog and either extend with a reason or confirm them as permanent.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {dueReviewEmployees.map((dueEmp) => (
                    <button
                      key={dueEmp.id}
                      onClick={() => handleOpenEdit(dueEmp)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-amber-900 border border-amber-200/90 text-[11px] font-bold shadow-2xs hover:shadow-xs transition cursor-pointer"
                    >
                      <span>{dueEmp.name}</span>
                      <span className="text-[9px] font-semibold text-amber-600">
                        ({dueEmp.employmentType})
                      </span>
                      <ArrowRight className="w-3 h-3 text-amber-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setOnlyDueReviews((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                  onlyDueReviews
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/60"
                }`}
              >
                {onlyDueReviews ? "Show All Employees" : "Filter Due Reviews"}
              </button>

              <button
                type="button"
                onClick={() => setIsBannerDismissed(true)}
                title="Dismiss banner"
                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-200/50 hover:text-amber-900 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. HEADER AREA & TOOLBAR */}
      <div className="flex flex-col gap-4 border-b border-line-subtle pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-content-main tracking-tight font-sans">
              Employees
            </h1>
            {dueReviewEmployees.length > 0 && (
              <button
                onClick={() => setOnlyDueReviews((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                  onlyDueReviews
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{dueReviewEmployees.length} Due Review</span>
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-content-secondary">
            Manage employee directory profiles, probation reviews, and lifecycle status.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative w-full sm:col-span-2 lg:col-span-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-4 w-4 text-content-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/25 focus:border-brand-accent transition-all duration-150 shadow-sm"
            />
          </div>

          <FilterSelect
            ariaLabel="Filter by department"
            icon={<Building2 className="w-3.5 h-3.5" />}
            options={departmentOptions}
            value={departmentFilter}
            onChange={setDepartmentFilter}
            className="w-full"
          />

          <FilterSelect
            ariaLabel="Filter by employment type"
            icon={<Briefcase className="w-3.5 h-3.5" />}
            options={EMPLOYMENT_TYPE_OPTIONS}
            value={employmentTypeFilter}
            onChange={setEmploymentTypeFilter}
            className="w-full"
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDepartmentFilter("All");
                setEmploymentTypeFilter("All");
                setOnlyDueReviews(false);
              }}
              title="Clear all filters"
              className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-line-subtle bg-surface-card px-3 py-2 text-xs font-bold text-content-secondary shadow-sm transition hover:text-content-main cursor-pointer sm:col-span-2 sm:w-auto sm:justify-self-start lg:col-span-3"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}

        </div>
      </div>

      {/* 3. DIRECTORY TABLE SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-[10px] font-extrabold uppercase tracking-widest text-content-muted">
            Directory List ({filteredEmployees.length})
            {onlyDueReviews && (
              <span className="ml-2 font-bold text-amber-600 lowercase">
                (showing due reviews only)
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setAddEmployeeError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-accent px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-150 hover:bg-brand-hover active:scale-[0.98] cursor-pointer sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add Employee</span>
          </button>
        </div>

        {isLoading ? (
          <div className="bg-surface-card rounded-2xl border border-line-subtle shadow-sm p-4 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse py-2">
                <div className="w-9 h-9 rounded-full bg-surface-main shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface-main rounded w-1/4" />
                  <div className="h-2.5 bg-surface-main rounded w-1/3" />
                </div>
                <div className="h-3 bg-surface-main rounded w-20 hidden sm:block" />
                <div className="h-3 bg-surface-main rounded w-16 hidden md:block" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 bg-amber-50/50 rounded-2xl border border-amber-100/80 text-amber-800 shadow-sm">
            <span className="text-xs font-semibold text-center">
              {getFriendlyErrorMessage(error)}
            </span>
            <button
              onClick={() => mutateEmployees()}
              className="mt-3 px-3.5 py-1.5 bg-brand-accent hover:bg-brand-hover text-white text-[10px] font-bold rounded-lg shadow-sm transition-all duration-150 active:scale-[0.95]"
            >
              Retry Loading Directory
            </button>
          </div>
        ) : employees.length === 0 ? (
          <EmptyState onAddClick={() => setIsAddModalOpen(true)} />
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-surface-card rounded-2xl border border-dashed border-line-subtle">
            <span className="text-content-secondary text-xs">
              No employees match your {hasActiveFilters ? "filters" : "search query"}.
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setDepartmentFilter("All");
                  setEmploymentTypeFilter("All");
                  setOnlyDueReviews(false);
                }}
                className="mt-3 px-3.5 py-1.5 bg-brand-accent hover:bg-brand-hover text-white text-[10px] font-bold rounded-lg shadow-sm transition-all duration-150 active:scale-[0.95] cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <EmployeeTable
            employees={filteredEmployees}
            onEdit={handleOpenEdit}
            onViewPortal={handleOpenView}
            onDelete={handleTableDelete}
            deletingId={deletingEmployeeId}
          />
        )}
      </div>

      {/* 4. MODALS */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddEmployeeError(null);
        }}
        errorMessage={getFriendlyErrorMessage(addEmployeeError)}
        onSave={handleCreateEmployee}
        departments={departments}
      />

      <EditEmployeeModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEmployee(null);
          setEditEmployeeError(null);
        }}
        errorMessage={getFriendlyErrorMessage(editEmployeeError)}
        employee={selectedEmployee}
        onSave={handleEditEmployee}
        departments={departments}
      />

      <ViewEmployeeModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onDelete={handleDeleteEmployee}
      />
    </div>
  );
}