"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ======================
   TYPES
====================== */

type DashboardStats = {
  totalCases: number;

  gender: {
    male: number;
    female: number;
  };

  outcome: Record<string, number>;
  triage: Record<string, number>;
  healthClassification: Record<string, number>;
  complaints: Record<string, number>;
  projects: Record<string, number>;

  responseTime: {
    avgMinutes: number;
    minMinutes: number;
    maxMinutes: number;
  };
};

/* ======================
   HELPERS
====================== */

/**
 * Safely convert Firestore Timestamp | Date | string | number to milliseconds
 */
function toMillisSafe(t: any): number | null {
  if (!t) return null;

  // Firestore Timestamp
  if (typeof t.toMillis === "function") {
    return t.toMillis();
  }

  // JavaScript Date
  if (t instanceof Date) {
    return t.getTime();
  }

  // ISO date string
  if (typeof t === "string") {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // Already milliseconds
  if (typeof t === "number") {
    return t;
  }

  return null;
}

/* ======================
   HOOK
====================== */

export function useEpcrDashboard(
  startDate?: Date,
  endDate?: Date
) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      /* ------------------
         QUERY ePCR
      ------------------- */
      let q = query(collection(db, "epcr"));

      if (startDate && endDate) {
        q = query(
          collection(db, "epcr"),
          where("finalizedAt", ">=", Timestamp.fromDate(startDate)),
          where("finalizedAt", "<=", Timestamp.fromDate(endDate))
        );
      }

      const snap = await getDocs(q);

      /* ------------------
         INIT COUNTERS
      ------------------- */
      let totalCases = 0;

      const gender = { male: 0, female: 0 };
      const outcome: Record<string, number> = {};
      const triage: Record<string, number> = {};
      const healthClassification: Record<string, number> = {};
      const complaints: Record<string, number> = {};
      const projects: Record<string, number> = {};

      let responseSum = 0;
      let responseMin = Infinity;
      let responseMax = 0;
      let responseCount = 0;

      /* ------------------
         LOOP ePCRs
      ------------------- */
      for (const epcrDoc of snap.docs) {
        const epcr = epcrDoc.data();
        totalCases++;

        /* Gender */
        if (epcr.patientInfo?.gender === "male") gender.male++;
        if (epcr.patientInfo?.gender === "female") gender.female++;

        /* Outcome */
        const dest = epcr.outcome?.destination;
        if (dest) {
          outcome[dest] = (outcome[dest] || 0) + 1;
        }

        /* Triage */
        const triageColor = epcr.patientInfo?.triageColor;
        if (triageColor) {
          triage[triageColor] = (triage[triageColor] || 0) + 1;
        }

        /* Health Classification */
        const hc = epcr.patientInfo?.healthClassification;
        if (hc) {
          healthClassification[hc] =
            (healthClassification[hc] || 0) + 1;
        }

        /* Chief Complaints */
        const cc: string[] = epcr.patientInfo?.chiefComplaints || [];
        cc.forEach((c) => {
          complaints[c] = (complaints[c] || 0) + 1;
        });

        /* Projects */
        const projectName = epcr.projectInfo?.projectName;
        if (projectName) {
          projects[projectName] =
            (projects[projectName] || 0) + 1;
        }

        /* ------------------
           RESPONSE TIME
           Received → OnScene
        ------------------- */
        const caseRef = doc(db, "cases", epcrDoc.id);
        const caseSnap = await getDoc(caseRef);

        if (caseSnap.exists()) {
          const timeline = caseSnap.data().timeline;

          const receivedMs = toMillisSafe(timeline?.Received);
          const onSceneMs = toMillisSafe(timeline?.OnScene);

          if (
            receivedMs !== null &&
            onSceneMs !== null &&
            onSceneMs > receivedMs
          ) {
            const minutes = (onSceneMs - receivedMs) / 60000;

            responseSum += minutes;
            responseMin = Math.min(responseMin, minutes);
            responseMax = Math.max(responseMax, minutes);
            responseCount++;
          }
        }
      }

      /* ------------------
         FINAL STATS
      ------------------- */
      setStats({
        totalCases,

        gender,
        outcome,
        triage,
        healthClassification,
        complaints,
        projects,

        responseTime: {
          avgMinutes:
            responseCount > 0
              ? Number((responseSum / responseCount).toFixed(1))
              : 0,
          minMinutes:
            responseMin === Infinity ? 0 : Math.round(responseMin),
          maxMinutes: Math.round(responseMax),
        },
      });

      setLoading(false);
    };

    load();
  }, [startDate, endDate]);

  return { loading, stats };
}
