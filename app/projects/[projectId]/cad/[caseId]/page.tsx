import { redirect } from "next/navigation";

export default function ProjectCaseRedirect({
  params,
}: {
  params: { projectId: string; caseId: string };
}) {
  redirect(`/cadcases/${params.caseId}`);
}
