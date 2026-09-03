"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

import CaseDetailsPage from "@/app/cases/[id]/page";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";

export default function ModernCadCaseDetailsPage({
  params,
}: {
  params: { caseId: string };
}) {
  const [resolvedId, setResolvedId] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const { user, loading: userLoading } = useCurrentUser();
  const { can, loading: permissionLoading } = usePermissions(user?.role);

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

  useEffect(() => {
    if (!resolvedId || userLoading || permissionLoading) return;

    setAuthorized(false);
    setAccessDenied(false);
    if (can("cad_cases_new", "view_all")) {
      setAuthorized(true);
      return;
    }

    getDoc(doc(db, "cases", resolvedId))
      .then((snapshot) => {
        if (!snapshot.exists()) {
          setNotFound(true);
          return;
        }
        const data = snapshot.data();
        const userId = user?.uid || "";
        const assigned = [
          ...(Array.isArray(data.assignedUserIds) ? data.assignedUserIds : []),
          ...(Array.isArray(data.participantUserIds) ? data.participantUserIds : []),
        ].includes(userId);
        if (can("cad_cases_new", "view_assigned") && assigned) {
          setAuthorized(true);
        } else {
          setAccessDenied(true);
        }
      })
      .catch((error) => {
        console.error("Could not authorize case access", error);
        setAccessDenied(true);
      });
  }, [can, permissionLoading, resolvedId, user?.uid, userLoading]);

  if (notFound) {
    return (
      <div className="page-shell">
        <div className="card-modern text-sm font-bold text-rose-700">
          No case was found for {decodeURIComponent(params.caseId)}.
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="page-shell">
        <div className="card-modern text-sm font-bold text-rose-700">
          You do not have permission to view this case.
        </div>
      </div>
    );
  }

  if (!resolvedId || !authorized) {
    return <div className="page-shell text-sm font-semibold text-[#607482]">Loading case...</div>;
  }

  return <CaseDetailsPage params={{ id: resolvedId }} />;
}
