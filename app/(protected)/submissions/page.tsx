// /app/(protected)/submissions/page.tsx

import CaseEpcrSubmissionsTable from "@/app/components/CaseEpcrSubmissionsTable";
import PermissionGuard from "@/app/components/PermissionGuard";

export default function SubmissionsPage() {
  return (
    <PermissionGuard module="submissions" action="view" showMessage={true}>
      <div className="w-full max-w-none space-y-6 p-6 text-[#274C5A]">
        <div className="rounded-2xl border border-[#86A7B2]/25 bg-[#274C5A] p-6 text-white shadow-sm">
          <div className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide">
            Submissions
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Case & ePCR Submissions
          </h1>
          <p className="mt-2 text-sm text-white/80">
            View all cases with their linked ePCR records in one place.
          </p>
        </div>

        <CaseEpcrSubmissionsTable />
      </div>
    </PermissionGuard>
  );
}
