"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import Swal from "sweetalert2";
import { Search, Filter, Building2, Calendar, CalendarDays } from "lucide-react";
import GeneratePayslipModal, { EmployeeOption } from "@/app/components/admin/GeneratePayslipModal";
import PayslipList, {
  CompanyDetailsData,
  ExtendedPayslipRecord,
} from "@/app/components/payslips/PayslipList";
import {
  getPayslipReferenceId,
  isPayslipReferenceQuery,
  matchesPayslipReferenceSearch,
} from "@/app/components/payslips/payslipPdf";
import { FilterSelect } from "@/app/components/ui/FilterSelect";

const ExtendedGeneratePayslipModal = GeneratePayslipModal as React.ComponentType<
  React.ComponentProps<typeof GeneratePayslipModal> & { companyDetails?: CompanyDetailsData | null }
>;

interface ReferencedEmployee {
  _id: string;
  name: string;
  jobTitle: string;
}

interface Payslip {
  _id: string;
  employeeId: ReferencedEmployee | null;
  employeeName?: string;
  employeeRole?: string;
  period: string;
  basicSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  tax?: number;
  taxMode?: "deduct" | "add";
  netPay: number;
  paymentMethod?: string;
  paymentDate?: string;
  status?: string;
  version?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function getCurrentMonthYear(): { month: string; year: string } {
  const now = new Date();
  return {
    month: now.toLocaleString("en-US", { month: "long" }),
    year: String(now.getFullYear()),
  };
}

function normalizeMonth(value: string): string {
  return value.trim().toLowerCase();
}

/** Parse payslip period strings like "July 2026" or "Jun 2026". */
function parsePayslipPeriod(periodRaw: string): { monthName: string | null; year: string | null } {
  const period = (periodRaw || "").trim();
  if (!period) return { monthName: null, year: null };

  const yearMatch = period.match(/(19\d{2}|20\d{2})/);
  const year = yearMatch ? yearMatch[1] : null;

  const normalized = period.replace(/,/g, " ").replace(/[-/]/g, " ").replace(/\s+/g, " ").trim();

  for (const month of MONTH_NAMES) {
    if (normalized.toLowerCase().includes(month.toLowerCase())) {
      return { monthName: month, year };
    }
  }

  const shortToFull: Record<string, string> = {
    jan: "January",
    feb: "February",
    mar: "March",
    apr: "April",
    may: "May",
    jun: "June",
    jul: "July",
    aug: "August",
    sep: "September",
    sept: "September",
    oct: "October",
    nov: "November",
    dec: "December",
  };

  for (const token of normalized.split(" ")) {
    const key = token.slice(0, 4).toLowerCase();
    if (shortToFull[key]) return { monthName: shortToFull[key], year };
    if (shortToFull[token.toLowerCase()]) return { monthName: shortToFull[token.toLowerCase()], year };
  }

  return { monthName: null, year };
}

export default function AdminPayslipsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  // Default: current calendar month + year so admins land on this month's payroll
  const [monthFilter, setMonthFilter] = useState(() => getCurrentMonthYear().month);
  const [yearFilter, setYearFilter] = useState(() => getCurrentMonthYear().year);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Both requests run in parallel and are cached — the employees key is
  // shared with the admin Employees page.
  const {
    data: payslipData,
    isLoading,
    mutate: mutatePayslips,
  } = useSWR<unknown>("/api/admin/payslips");

  const { data: employeeData } = useSWR<unknown>("/api/admin/employees");

  const { payslips, companyDetails } = useMemo(() => {
    const data = payslipData as
      | Payslip[]
      | { payslips?: Payslip[]; data?: Payslip[]; companyDetails?: CompanyDetailsData }
      | undefined;

    if (Array.isArray(data)) {
      return { payslips: data, companyDetails: null };
    }
    return {
      payslips: data?.payslips || data?.data || [],
      companyDetails: data?.companyDetails || null,
    };
  }, [payslipData]);

  const employees = useMemo<EmployeeOption[]>(() => {
    const data = employeeData as
      | EmployeeOption[]
      | { employees?: EmployeeOption[]; data?: EmployeeOption[] }
      | undefined;
    if (Array.isArray(data)) return data;
    return data?.employees || data?.data || [];
  }, [employeeData]);

  // Payslips reference the employee _id; the directory list carries each
  // employee's department, so one lookup map links the two.
  const departmentByEmployeeId = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((emp) => {
      const empId = emp.id || emp._id;
      if (empId && emp.department) map.set(String(empId), emp.department);
    });
    return map;
  }, [employees]);

  const departmentOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        employees
          .map((emp) => emp.department)
          .filter((dept): dept is string => Boolean(dept?.trim()))
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      { value: "All", label: "All Departments" },
      ...unique.map((dept) => ({ value: dept, label: dept })),
    ];
  }, [employees]);

  const monthOptions = useMemo(
    () => [
      { value: "All", label: "All Months" },
      ...MONTH_NAMES.map((m) => ({ value: m, label: m })),
    ],
    []
  );

  const yearOptions = useMemo(() => {
    const years = new Set<string>([String(new Date().getFullYear())]);
    payslips.forEach((slip) => {
      const { year } = parsePayslipPeriod(slip.period || "");
      if (year) years.add(year);
    });

    return [
      { value: "All", label: "All Years" },
      ...Array.from(years)
        .sort((a, b) => b.localeCompare(a))
        .map((y) => ({ value: y, label: y })),
    ];
  }, [payslips]);

  const defaultPeriod = useMemo(() => getCurrentMonthYear(), []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace(/\u0024/g, "");
  };

  const handleSavePayslip = async (newSlip: {
    employeeId: string;
    period: string;
    basicSalary: number;
    allowances: number;
    deductions: number;
    bonus: number;
    tax: number;
    taxMode: "deduct" | "add";
    netPay: number;
    paymentMethod: string;
    paymentDate: string;
  }) => {
    try {
      const response = await fetch("/api/admin/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSlip),
      });

      if (!response.ok) {
        const rawText = await response.text();
        let errorMessage = `HTTP error! Status: ${response.status}`;

        try {
          const errorData = JSON.parse(rawText);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch {
          if (rawText) {
            errorMessage = rawText.slice(0, 200);
          }
        }
        throw new Error(errorMessage);
      }

      await response.json();
      // Revalidate so re-generated slips for the same employee/period all appear
      await mutatePayslips();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Submission failed:", err);
      alert(err instanceof Error ? err.message : "Failed to record payment. Please check parameters and try again.");
    }
  };

  const handleDeletePayslip = async (slip: ExtendedPayslipRecord) => {
    const employeeObj =
      typeof slip.employeeId === "object" && slip.employeeId !== null ? slip.employeeId : null;
    const employeeName = employeeObj?.name || slip.employeeName || "this employee";
    const refId = getPayslipReferenceId(slip._id);

    const result = await Swal.fire({
      title: "Delete Payslip?",
      html: `Payslip <b>${refId}</b> for <b>${employeeName}</b> (${slip.period}) will be permanently removed.<br/>This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
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

    setDeletingId(slip._id);
    try {
      const res = await fetch(`/api/admin/payslips/${slip._id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Failed to delete payslip.");
      }

      await mutatePayslips();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Payslip deleted",
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error("Payslip deletion failed:", err);
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: err instanceof Error ? err.message : "Could not delete the payslip. Try again.",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPayslips = (payslips || []).filter((slip) => {
    const employeeObj = typeof slip.employeeId === "object" && slip.employeeId !== null 
      ? slip.employeeId 
      : null;

    const name = employeeObj?.name || slip.employeeName || "";
    const role = employeeObj?.jobTitle || slip.employeeRole || "";
    const period = slip.period || "";
    const refId = getPayslipReferenceId(slip._id);
    const q = searchQuery.trim().toLowerCase();
    const refSearch = isPayslipReferenceQuery(searchQuery);

    const matchesSearch =
      !q ||
      name.toLowerCase().includes(q) ||
      role.toLowerCase().includes(q) ||
      period.toLowerCase().includes(q) ||
      refId.toLowerCase().includes(q) ||
      matchesPayslipReferenceSearch(slip._id, searchQuery);

    const slipDepartment = employeeObj?._id
      ? departmentByEmployeeId.get(String(employeeObj._id))
      : undefined;
    const matchesDepartment =
      departmentFilter === "All" || slipDepartment === departmentFilter;

    const { monthName, year } = parsePayslipPeriod(period);
    // Reference lookup ignores month/year so PAY-xxx finds across all periods
    const matchesMonth =
      refSearch ||
      monthFilter === "All" ||
      (monthName ? normalizeMonth(monthName) === normalizeMonth(monthFilter) : false);
    const matchesYear =
      refSearch || yearFilter === "All" || (year ? year === yearFilter : false);

    return matchesSearch && matchesDepartment && matchesMonth && matchesYear;
  });

  const isDefaultPeriod =
    monthFilter === defaultPeriod.month && yearFilter === defaultPeriod.year;
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    departmentFilter !== "All" ||
    !isDefaultPeriod;

  const resetFilters = () => {
    const current = getCurrentMonthYear();
    setSearchQuery("");
    setDepartmentFilter("All");
    setMonthFilter(current.month);
    setYearFilter(current.year);
  };

  const periodSummary =
    monthFilter === "All" && yearFilter === "All"
      ? ""
      : monthFilter === "All"
        ? ` in ${yearFilter}`
        : yearFilter === "All"
          ? ` in ${monthFilter}`
          : ` for ${monthFilter} ${yearFilter}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-line-subtle pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-content-main sm:text-2xl">
            Paid Payslips Ledger
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-content-secondary">
            Monitor compensations and download official PDF salary statements.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-accent px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all duration-150 hover:bg-brand-hover active:scale-[0.98] cursor-pointer sm:w-auto"
        >
          <span>Record Payment</span>
        </button>
      </div>

      {/* Filter bar — full width, aligned grid */}
      <div className="bg-surface-card border border-line-subtle rounded-2xl p-3.5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-2.5 items-center">
          <div className="relative xl:col-span-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-content-muted" />
            </div>
            <input
              type="text"
              placeholder="Search name, role, period, or ref (PAY-...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-surface-main border border-line-subtle rounded-xl text-xs text-content-main placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition duration-150"
            />
          </div>

          <FilterSelect
            ariaLabel="Filter by department"
            icon={<Building2 className="w-3.5 h-3.5" />}
            options={departmentOptions}
            value={departmentFilter}
            onChange={setDepartmentFilter}
            className="xl:col-span-3"
          />

          <FilterSelect
            ariaLabel="Filter by month"
            icon={<Calendar className="w-3.5 h-3.5" />}
            options={monthOptions}
            value={monthFilter}
            onChange={setMonthFilter}
            className="xl:col-span-3"
          />

          <FilterSelect
            ariaLabel="Filter by year"
            icon={<CalendarDays className="w-3.5 h-3.5" />}
            options={yearOptions}
            value={yearFilter}
            onChange={setYearFilter}
            className="xl:col-span-2"
          />
        </div>
      </div>

      {/* Counter Row */}
      <div className="flex items-center justify-between px-1">
        <div className="inline-flex items-center gap-1.5 text-content-secondary text-[11px] font-semibold">
          <Filter className="w-3.5 h-3.5 text-content-muted" />
          <span>
            Showing {filteredPayslips.length} paid entries
            {periodSummary}
            {departmentFilter !== "All" ? ` · ${departmentFilter}` : ""}
          </span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] font-bold text-brand-accent hover:text-brand-hover transition cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Payslips Table List */}
      <PayslipList
        payslips={filteredPayslips}
        isLoading={isLoading}
        downloadingId={downloadingId}
        onDownloadStart={(id) => setDownloadingId(id)}
        onDownloadEnd={() => setDownloadingId(null)}
        title="Paid Records"
        emptyMessage={
          isDefaultPeriod && !searchQuery.trim() && departmentFilter === "All"
            ? `No payslips recorded for ${defaultPeriod.month} ${defaultPeriod.year} yet.`
            : "No payslips match your current filters."
        }
        showAdminControls
        showVersion={false}
        showPaymentDate
        showReference
        formatCurrency={formatCurrency}
        companyDetails={companyDetails}
        onDelete={handleDeletePayslip}
        deletingId={deletingId}
      />

      {/* Generate Payslip Modal */}
      <ExtendedGeneratePayslipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employees={employees}
        isLoading={isLoading} 
        onSave={handleSavePayslip}
        companyDetails={companyDetails}
      />
    </div>
  );
}