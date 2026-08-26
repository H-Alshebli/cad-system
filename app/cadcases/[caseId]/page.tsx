"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

import CaseDetailsPage from "@/app/cases/[id]/page";
import { db } from "@/lib/firebase";

export default function ModernCadCaseDetailsPage({
  params,
}: {
  params: { caseId: string };
}) {
  const [resolvedId, setResolvedId] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const reference = decodeURIComponent(params.caseId).trim();
    if (!/^HCAD-\d+$/i.test(reference)) {
      setResolvedId(reference);
      return;
    }

    getDocs(
      query(
        collection(db, "cases"),
        where("caseNumber", "==", reference.toUpperCase()),
        limit(1)
      )
    )
      .then((snapshot) => {
        if (snapshot.empty) {
          setNotFound(true);
          return;
        }
        setResolvedId(snapshot.docs[0].id);
      })
      .catch((error) => {
        console.error("Could not resolve case number", error);
        setNotFound(true);
      });
  }, [params.caseId]);

  if (notFound) {
    return (
      <div className="page-shell">
        <div className="card-modern text-sm font-bold text-rose-700">
          No case was found for {decodeURIComponent(params.caseId)}.
        </div>
      </div>
    );
  }

  if (!resolvedId) {
    return <div className="page-shell text-sm font-semibold text-[#607482]">Loading case...</div>;
  }

  return <CaseDetailsPage params={{ id: resolvedId }} />;
}
