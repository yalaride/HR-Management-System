// components/LeaveHeader.tsx
import React from "react";
import { Search } from "lucide-react";

interface LeaveHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const LeaveHeader: React.FC<LeaveHeaderProps> = ({
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <div className="flex flex-col gap-4 border-b border-line-subtle pb-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-content-main sm:text-2xl">
          Leave Manager
        </h1>
        <p className="mt-1 text-xs font-medium text-content-secondary">
          Review, approve, and filter all employee leave requests and historical records.
        </p>
      </div>

      <div className="relative w-full shrink-0 lg:w-72">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <Search className="h-4 w-4 text-content-muted transition-colors duration-200 group-hover:text-content-main" />
        </div>
        <input
          type="text"
          placeholder="Search employee, type, or reason..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input-with-icon text-xs py-2 h-9 pl-9"
        />
      </div>
    </div>
  );
};