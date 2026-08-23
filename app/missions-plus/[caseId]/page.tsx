import { MissionAcknowledgeExperience } from "@/app/missions/[caseId]/MissionAcknowledgeExperience";

export default function MissionPlusDetailsPage({ params }: { params: { caseId: string } }) {
  return <MissionAcknowledgeExperience params={params} enhanced />;
}
