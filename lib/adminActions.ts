import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function assignLegacyCasesToMDL() {

  const snapshot = await getDocs(collection(db, "cases"));

  const legacyCases = snapshot.docs.filter(
    (d) => !d.data().projectId
  );

  if (legacyCases.length === 0) {
    alert("No legacy cases found ✅");
    return;
  }

  const confirmRun = confirm(
    `Assign ${legacyCases.length} cases to MDL Soundstorm 25?`
  );
  if (!confirmRun) return;

  for (const d of legacyCases) {
    await updateDoc(doc(db, "cases", d.id), {
      projectId: "mdl-soundstorm-25",
    });
  }

  alert(`✅ ${legacyCases.length} cases assigned successfully`);
}
