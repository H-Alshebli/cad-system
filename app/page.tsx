

import { redirect } from "next/navigation";
import StatusButtons from "@/app/components/StatusButtons";

export default function Home() {
  redirect("/cases");
}
