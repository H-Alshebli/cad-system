"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  Timestamp,
  onSnapshot,
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
 * Convert "HH:mm" → total minutes
 * Example: "12:03" → 723
 */
function hhmmToMinutes(time?: string): number | null {
  if (!time) return null;

  const parts = time.split(":");
  if (parts.length !== 2) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (isNaN(hours) || isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

/* ======================
   HOOK
====================== */

export function useEpcrDashboard(
  startDate?: Date,
  endDate?: Date,
  projectFilter?: string
) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const constraints: any[] = [];

    if (startDate && endDate) {
      constraints.push(
        where("finalizedAt", ">=", Timestamp.fromDate(startDate)),
        where("finalizedAt", "<=", Timestamp.fromDate(endDate))
      );
    }

    const epcrQuery =
      constraints.length > 0
        ? query(collection(db, "epcr"), ...constraints)
        : query(collection(db, "epcr"));

    setLoading(true);

    const unsub = onSnapshot(epcrQuery, (epcrSnap) => {
      /* ------------------
         INIT STATS
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

      for (const epcrDoc of epcrSnap.docs) {
        const epcr = epcrDoc.data();

        const projectName = epcr.projectInfo?.projectName;
        if (projectName) {
          projects[projectName] = (projects[projectName] || 0) + 1;
        }

        if (projectFilter && projectName !== projectFilter) continue;

        totalCases++;

        if (epcr.patientInfo?.gender === "male") gender.male++;
        if (epcr.patientInfo?.gender === "female") gender.female++;

        const dest = epcr.outcome?.destination;
        if (dest) outcome[dest] = (outcome[dest] || 0) + 1;

        const triageColor = epcr.patientInfo?.triageColor;
        if (triageColor) triage[triageColor] = (triage[triageColor] || 0) + 1;

        const hc = epcr.patientInfo?.healthClassification;
        if (hc) {
          healthClassification[hc] =
            (healthClassification[hc] || 0) + 1;
        }

        const cc: string[] = epcr.patientInfo?.chiefComplaints || [];
        cc.forEach((c) => {
          complaints[c] = (complaints[c] || 0) + 1;
        });

        const movingMin = hhmmToMinutes(epcr.time?.movingTime?.timeHHMM);
        const arrivalMin = hhmmToMinutes(
          epcr.time?.arrivalToPTTime?.timeHHMM
        );

        if (
          movingMin !== null &&
          arrivalMin !== null &&
          arrivalMin > movingMin
        ) {
          const minutes = arrivalMin - movingMin;
          responseSum += minutes;
          responseMin = Math.min(responseMin, minutes);
          responseMax = Math.max(responseMax, minutes);
          responseCount++;
        }
      }

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
          maxMinutes:
            responseCount > 0 ? Math.round(responseMax) : 0,
        },
      });

      setLoading(false);
    });

    return () => unsub();
  }, [startDate, endDate, projectFilter]);

  // ✅ THIS IS THE MISSING PART
  return { loading, stats };
}
