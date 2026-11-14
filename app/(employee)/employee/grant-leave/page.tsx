"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import GrantLeaveForm from "@/app/components/leaves/GrantLeaveForm";

export default function GrantLeavePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isEmployeeSession = session?.user?.role === "employee";
  const { data: desk } = useSWR<{ active?: boolean }>(isEmployeeSession ? "/api/employee/desk" : null);

  useEffect(() => {
    if (!isEmployeeSession || !desk) return;
    if (!desk.active) router.replace("/employee/dashboard");
  }, [desk, isEmployeeSession, router]);

  if (isEmployeeSession && !desk?.active) return null;

  return (
    <div className="space-y-6 pb-12">
      <GrantLeaveForm />
    </div>
  );
}
