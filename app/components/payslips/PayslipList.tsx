"use client";

import React from "react";
import Swal from "sweetalert2";
import { Calendar, CheckCircle2, Download, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { downloadPayslipPdf, getPayslipReferenceId, PayslipRecord } from "./payslipPdf";

export interface ExtendedPayslipRecord extends PayslipRecord {
  status?: string;
  version?: string;
  Version?: string; // legacy capitalized variant from older records
}

export interface CompanyDetailsData {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  logo?: string;
  companyName?: string;
  location?: string;
  brandAccent?: string;
  brand_accent?: string;
  [key: string]: unknown;
}

interface PayslipListProps {
  payslips: ExtendedPayslipRecord[];
  isLoading?: boolean;
  downloadingId?: string | null;
  onDownloadStart?: (id: string) => void;
  onDownloadEnd?: (id: string) => void;
  title?: string;
  emptyMessage?: string;
  showAdminControls?: boolean;
  showEmployeeColumn?: boolean; 
  showDetailedBreakdown?: boolean;
  showVersion?: boolean;
  showPaymentDate?: boolean;
  showReference?: boolean;
  formatCurrency?: (amount: number) => string;
  companyDetails?: CompanyDetailsData | null; // Keep companyDetails in the prop definitions
  /** When provided (admin), a delete button appears next to Download */
  onDelete?: (slip: ExtendedPayslipRecord) => void;
  deletingId?: string | null;
}

const swalCustomClass = {
  popup: "bg-white rounded-2xl border border-line-subtle shadow-xl font-sans",
  title: "text-sm font-bold text-content-main",
  htmlContainer: "text-xs text-content-secondary",
  confirmButton: "px-4.5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-accent hover:bg-brand-hover border-none outline-none cursor-pointer transition",
};

function formatPaymentDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Declaring ": React.JSX.Element" tells TypeScript this function must return JSX
export default function PayslipList({
  payslips,
  isLoading = false,
  downloadingId = null,
  onDownloadStart,
  onDownloadEnd,
  title = "Paid Records",
  emptyMessage = "No matching paid payslips found.",
  showAdminControls = false,
  showEmployeeColumn = true, 
  showDetailedBreakdown = false,
  showVersion = false,
  showPaymentDate = false,
  showReference = false,
  formatCurrency,
  companyDetails = null,
  onDelete,
  deletingId = null,
}: PayslipListProps): React.JSX.Element {
  
  const handleDownload = async (slip: PayslipRecord) => {
    if (onDownloadStart) onDownloadStart(slip._id);

    try {
      // Fetch dynamic details for this precise payslip ID using a query parameter
      const res = await fetch(`/api/admin/payslips?id=${slip._id}`);
      if (!res.ok) {
        throw new Error(`Server returned status: ${res.status}`);
      }

      const { payslip: freshSlip, companyDetails: freshCompanyDetails } = await res.json();

      const employeeObj = typeof freshSlip.employeeId === "object" && freshSlip.employeeId !== null 
        ? freshSlip.employeeId 
        : null;
      
      const employeeName = employeeObj?.name || freshSlip.employeeName || "Unknown Employee";
      const employeeRole = employeeObj?.jobTitle || freshSlip.employeeRole || "No Specified Title";

      // Call PDF compiler with database values
      await downloadPayslipPdf({
        slip: freshSlip,
        employeeName,
        employeeRole,
        formatCurrency,
        companyDetails: freshCompanyDetails || companyDetails, 
      });

    } catch (error) {
      console.error("Failed to generate PDF:", error);
      Swal.fire({
        icon: "error",
        title: "Compilation Failed",
        text: "Could not generate your receipt. Please verify your database connection and try again.",
        confirmButtonColor: "#7c3aed",
        customClass: swalCustomClass
      });
    } finally {
      if (onDownloadEnd) onDownloadEnd(slip._id);
    }
  };

  let totalColumns = 5; 
  if (showEmployeeColumn) totalColumns += 1;
  if (showDetailedBreakdown) totalColumns += 3;
  totalColumns += 1; 
  if (showVersion) totalColumns += 1;
  if (showPaymentDate) totalColumns += 1;
  if (showReference) totalColumns += 1;

  return (
    <div className="table-card">
      {/* Header Panel */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-line-subtle bg-surface-main/60">
        <div className="text-xs font-bold text-content-main tracking-wide uppercase">
          {title}
        </div>

        {!showAdminControls && (
          <div className="inline-flex items-center gap-1.5 text-content-secondary text-[11px] font-semibold">
            <span>{payslips.length} records</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="table-head">
              {showEmployeeColumn && <th className="px-6 py-4">Employee</th>}
              <th className="px-6 py-4">Pay Period</th>
              <th className="px-6 py-4 text-right">Basic Salary</th>
              
              {showDetailedBreakdown && (
                <>
                  <th className="px-6 py-4 text-right text-emerald-600">Allowances</th>
                  <th className="px-6 py-4 text-right text-brand-accent">Bonus</th>
                  <th className="px-6 py-4 text-right text-rose-600">Deductions</th>
                </>
              )}
              <th className="px-6 py-4 text-right text-rose-600">Tax</th>
              
              <th className="px-6 py-4 text-right">Net Take-Home</th>
              {showPaymentDate && (
                <th className="px-6 py-4 text-center">Payment Date</th>
              )}
              {showReference && (
                <th className="px-6 py-4 text-center">Reference</th>
              )}
              {showVersion && (
                <th className="px-6 py-4 text-center">Version</th>
              )}
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle text-content-secondary text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={totalColumns} className="px-6 py-12 text-center text-content-muted">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium">Loading payroll records...</span>
                  </div>
                </td>
              </tr>
            ) : payslips.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="px-6 py-12 text-center text-content-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-6 h-6 text-content-muted/60" />
                    <span className="font-medium">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              payslips.map((slip) => {
                const employeeObj = typeof slip.employeeId === "object" && slip.employeeId !== null ? slip.employeeId : null;
                const employeeName = employeeObj?.name || slip.employeeName || "Unknown Employee";
                const employeeRole = employeeObj?.jobTitle || slip.employeeRole || "No Specified Title";
                const initials = employeeName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const isCurrentlyDownloading = downloadingId === slip._id;
                const isCurrentlyDeleting = deletingId === slip._id;

                return (
                  <tr key={slip._id} className="table-row-hover">
                    {showEmployeeColumn && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const imageUrl =
                              employeeObj?.profilePhotoUrl ||
                              employeeObj?.profilePhotoURL ||
                              employeeObj?.profilePhoto ||
                              employeeObj?.image ||
                              employeeObj?.picture ||
                              employeeObj?.profilePicture ||
                              employeeObj?.profilePic;

                            if (typeof imageUrl === "string" && imageUrl.trim()) {
                              return (
                                <div className="w-9 h-9 rounded-xl bg-brand-subtle text-brand-accent border border-line-subtle overflow-hidden">
                                  <img
                                    src={imageUrl}
                                    alt={employeeName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      target.onerror = null;
                                      target.style.display = "none";
                                    }}
                                  />
                                </div>
                              );
                            }

                            return (
                              <div className="w-9 h-9 rounded-xl bg-brand-subtle text-brand-accent border border-line-subtle flex items-center justify-center font-bold text-[11px]">
                                {initials}
                              </div>
                            );
                          })()}
                          <div>
                            <span className="font-bold text-content-main block leading-tight">{employeeName}</span>
                            <span className="text-[10px] text-content-muted font-medium mt-0.5 block">{employeeRole}</span>
                          </div>
                        </div>
                      </td>
                    )}

                    <td className="px-6 py-4">
                      <span className="font-semibold text-content-main flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-content-muted" />
                        {slip.period}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-content-secondary">
                      {formatCurrency ? formatCurrency(slip.basicSalary) : slip.basicSalary}
                    </td>

                    {showDetailedBreakdown && (
                      <>
                        <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                          {formatCurrency ? formatCurrency(slip.allowances || 0) : (slip.allowances || 0)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-brand-accent">
                          {formatCurrency ? formatCurrency(slip.bonus || 0) : (slip.bonus || 0)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-rose-600">
                          -{formatCurrency ? formatCurrency(slip.deductions || 0) : (slip.deductions || 0)}
                        </td>
                      </>
                    )}

                    <td className="px-6 py-4 text-right font-semibold">
                      {(slip.tax || 0) <= 0 ? (
                        <span className="text-content-muted">—</span>
                      ) : slip.taxMode === "add" ? (
                        <span className="text-emerald-600">
                          +{formatCurrency ? formatCurrency(slip.tax || 0) : slip.tax}
                        </span>
                      ) : (
                        <span className="text-rose-600">
                          -{formatCurrency ? formatCurrency(slip.tax || 0) : slip.tax}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right font-extrabold text-content-main">
                      <span className="text-brand-accent">
                        {formatCurrency ? formatCurrency(slip.netPay) : slip.netPay}
                      </span>
                    </td>

                    {showPaymentDate && (
                      <td className="px-6 py-4 text-center font-semibold text-content-secondary">
                        {formatPaymentDate(slip.paymentDate)}
                      </td>
                    )}

                    {showReference && (
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-main border border-line-subtle font-mono text-[10px] font-bold text-content-main tracking-wide">
                          {getPayslipReferenceId(slip._id)}
                        </span>
                      </td>
                    )}

                    {showVersion && (
                      <td className="px-6 py-4 text-center">
                        {String(slip.version ?? slip.Version ?? "").trim() ? (
                          <span className="font-bold text-content-secondary">
                            {String(slip.version ?? slip.Version)}
                          </span>
                        ) : (
                          <span className="text-content-muted">-</span>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center">
                        {slip.status === "Suspended" ? (
                          <span className="status-pill bg-rose-50 text-rose-700 border-rose-100">
                            <AlertCircle className="w-3 h-3 text-rose-500" />
                            Void
                          </span>
                        ) : (
                          <span className="status-pill bg-emerald-50 text-emerald-700 border-emerald-100">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Paid
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownload(slip)}
                          disabled={isCurrentlyDownloading || isCurrentlyDeleting}
                          className={`btn-table-download ${
                            isCurrentlyDownloading
                              ? "bg-surface-main text-content-muted border-line-subtle cursor-not-allowed"
                              : "bg-brand-subtle hover:bg-brand-accent hover:text-white text-brand-accent border-brand-subtle cursor-pointer"
                          }`}
                        >
                          {isCurrentlyDownloading ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-content-muted border-t-transparent rounded-full animate-spin" />
                              <span>Compiling...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </>
                          )}
                        </button>

                        {onDelete && (
                          <button
                            onClick={() => onDelete(slip)}
                            disabled={isCurrentlyDeleting || isCurrentlyDownloading}
                            title="Delete payslip"
                            className="p-2 rounded-lg border border-transparent text-content-muted hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCurrentlyDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
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
  );
}