"use client";

import CasesDashboardPlusPage from "@/app/components/CasesDashboardPlus";

export default function ProjectCasesDashboardPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <CasesDashboardPlusPage projectId={params.projectId} />;
}
