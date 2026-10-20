import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Sidebar, { SidebarProvider } from "../../components/Slidebar";
import ProfileCompletionPrompt from "../../components/employee/ProfileCompletionPrompt";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  // Restore the user's collapse preference without a hydration flash
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="min-h-screen bg-surface-main flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
        {/* Sidebar configured for Employee role */}
        <Sidebar role="employee" />

        {/* Main Content Area */}
        <main className="min-w-0 w-full flex-1 p-4 sm:p-6 lg:p-8 lg:h-screen lg:overflow-y-auto bg-surface-main scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
          <ProfileCompletionPrompt />
        </main>
      </div>
    </SidebarProvider>
  );
}
