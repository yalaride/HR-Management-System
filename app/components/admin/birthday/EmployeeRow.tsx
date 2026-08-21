import React from "react";
import { Calendar, MailCheck, MailWarning, MailX } from "lucide-react";
import { EmployeeBirthday } from "@/lib/types";

interface EmployeeRowProps {
  employee: EmployeeBirthday;
  isToday: boolean;
  onViewDetails: (emp: EmployeeBirthday) => void;
  formatBirthdate: (day: number, monthIdx: number) => string;
  getInitials: (name: string) => string;
}

export const EmployeeRow: React.FC<EmployeeRowProps> = ({
  employee,
  isToday,
  onViewDetails,
  formatBirthdate,
  getInitials,
}) => {
  const photoUrl = employee.profilePhotoUrl?.trim() || "";

  return (
    <div
      className={`p-4 sm:px-6 transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line-subtle last:border-b-0 hover:bg-surface-main/30 group ${
        isToday
          ? "bg-brand-subtle/15 border-l-4 border-brand-accent"
          : "bg-surface-card"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 select-none border transition-all duration-300 overflow-hidden relative ${
            isToday
              ? "bg-brand-subtle text-brand-accent border-brand-accent/25 shadow-xs"
              : "bg-surface-main text-content-secondary border-line-subtle group-hover:border-line-subtle/80 group-hover:scale-105"
          }`}
        >
          {getInitials(employee.name)}
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={employee.name}
              className="absolute inset-0 w-full h-full object-cover rounded-xl"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-content-main text-sm tracking-tight transition-colors duration-200 group-hover:text-brand-accent">
              {employee.name}
            </span>

            <span className="text-[9px] font-bold bg-brand-subtle/50 text-brand-accent px-2 py-0.5 rounded-md border border-brand-accent/10 tracking-wider uppercase">
              {employee.department || "—"}
            </span>

            {isToday && (
              <span className="text-[9px] font-extrabold bg-brand-accent text-white px-2 py-0.5 rounded-md border border-brand-hover tracking-wider uppercase shadow-xs flex items-center gap-1 select-none">
                <span className="inline-block w-1 h-1 rounded-full bg-white animate-ping" />
                Today 🎂
              </span>
            )}

            {employee.birthdayEmailStatus === "Sent" && (
              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 tracking-wider uppercase flex items-center gap-1">
                <MailCheck className="w-3 h-3" />
                Email Sent
              </span>
            )}
            {employee.birthdayEmailStatus === "Failed" && (
              <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200 tracking-wider uppercase flex items-center gap-1">
                <MailX className="w-3 h-3" />
                Email Failed
              </span>
            )}
            {(employee.birthdayEmailStatus === "Pending" ||
              employee.birthdayEmailStatus === "Scheduled" ||
              !employee.birthdayEmailStatus) &&
              isToday && (
                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200 tracking-wider uppercase flex items-center gap-1">
                  <MailWarning className="w-3 h-3" />
                  Email Pending
                </span>
              )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-content-secondary font-medium">
              {employee.designation || "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex sm:flex-row items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-line-subtle/40 pt-3 sm:pt-0">
        <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end gap-2.5 sm:gap-0.5">
          <span className="text-xs font-bold text-content-main flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-accent/90" />
            {formatBirthdate(employee.birthDay, employee.birthMonth)}
          </span>
          <span className="text-[10px] text-content-muted font-bold uppercase tracking-wider">
            Born: {employee.birthDate.split("-")[0]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(employee)}
            className="btn-outline !w-auto px-4 py-2 text-xs font-bold cursor-pointer transition-all duration-300"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};
