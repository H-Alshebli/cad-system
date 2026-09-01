"use client";

import PermissionGuard from "@/app/components/PermissionGuard";
import LegacyCasesDashboardPage from "@/app/(protected)/dashboard/epcr/page";

export default function CasesLegacyDashboardPage() {
  return (
    <PermissionGuard module="dashboards" action="epcr_legacy" showMessage>
      <LegacyCasesDashboardPage />
    </PermissionGuard>
  );
}
