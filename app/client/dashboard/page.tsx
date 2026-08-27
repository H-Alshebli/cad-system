"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

export default function ClientDashboardsIndexPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const { can, loading: permissionsLoading } = usePermissions(user?.role);

  const destination = can("client_dashboards", "timeline")
    ? "/client/dashboard/timeline"
    : can("client_dashboards", "epcr")
    ? "/client/dashboard/epcr"
    : "";

  useEffect(() => {
    if (!userLoading && !permissionsLoading && destination) router.replace(destination);
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
