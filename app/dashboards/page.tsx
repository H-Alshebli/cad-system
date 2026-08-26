"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

export default function DashboardsIndexPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const { can, isAdmin, loading: permissionsLoading } = usePermissions(user?.role);

  const destination =
    isAdmin || can("dashboards", "timeline")
      ? "/dashboards/timeline"
      : can("dashboards", "epcr")
      ? "/dashboards/cases"
      : can("checklist_review_global", "view")
      ? "/dashboards/checklists"
      : "";

  useEffect(() => {
    if (!userLoading && !permissionsLoading && destination) {
      router.replace(destination);
    }
  }, [destination, permissionsLoading, router, userLoading]);

  if (userLoading || permissionsLoading || destination) {
    return <div className="p-6 text-sm font-semibold text-[#607482]">Opening dashboards...</div>;
  }

  return (
    <div className="p-6">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
        No dashboard access has been assigned to your role.
      </div>
    </div>
  );
}
