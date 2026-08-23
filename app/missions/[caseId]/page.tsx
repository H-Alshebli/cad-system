import { MissionAcknowledgeExperience } from "./MissionAcknowledgeExperience";

export default function MissionAcknowledgePage({ params }: { params: { caseId: string } }) {
  return <MissionAcknowledgeExperience params={params} />;
}
