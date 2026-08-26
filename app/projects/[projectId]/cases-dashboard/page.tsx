"use client";

import EpcrDashboardPage from "@/app/(protected)/dashboard/epcr/page";
import { CasesDashboardScope } from "@/app/components/CasesDashboardScope";

export default function ProjectCasesDashboardPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <CasesDashboardScope projectId={params.projectId} embedded>
      <EpcrDashboardPage />
    </CasesDashboardScope>
  );
}
