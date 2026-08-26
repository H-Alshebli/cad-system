"use client";

import PermissionGuard from "@/app/components/PermissionGuard";
import { ChecklistReviewScope } from "@/app/components/ChecklistReviewScope";
import ProjectChecklistsPage from "@/app/projects/[projectId]/checklists/page";

export default function AllProjectsChecklistReviewPage() {
  return (
    <PermissionGuard module="checklist_review_global" action="view" showMessage>
      <div className="min-h-screen bg-[#f5f7f8] p-6 text-[#274C5A]">
        <ChecklistReviewScope allProjects>
          <ProjectChecklistsPage params={{ projectId: "" }} />
        </ChecklistReviewScope>
      </div>
    </PermissionGuard>
  );
}
