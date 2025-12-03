import CaseDetailsClient from "./ClientCaseDetails";

export default async function CaseDetails({
  params,
}: {
  params: { id: string };
}) {
  return <CaseDetailsClient caseId={params.id} />;
}
