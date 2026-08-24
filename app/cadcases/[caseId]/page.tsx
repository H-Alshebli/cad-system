import CaseDetailsPage from "@/app/cases/[id]/page";

export default function ModernCadCaseDetailsPage({
  params,
}: {
  params: { caseId: string };
}) {
  return <CaseDetailsPage params={{ id: params.caseId }} />;
}
