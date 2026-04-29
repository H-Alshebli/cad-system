// /app/(protected)/submissions/page.tsx

import CaseEpcrSubmissionsTable from "@/app/components/CaseEpcrSubmissionsTable";

export default function SubmissionsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Case & ePCR Submissions
        </h1>
        <p className="text-sm text-gray-400">
          View all cases with their linked ePCR records in one place.
        </p>
      </div>

      <CaseEpcrSubmissionsTable />
    </div>
  );
}