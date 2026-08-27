"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ClientBrand = {
  clientName: string;
  logoUrl: string;
};

const EMPTY_BRAND: ClientBrand = { clientName: "Client", logoUrl: "" };

export function useClientBrand(uid?: string) {
  const [brand, setBrand] = useState<ClientBrand>(EMPTY_BRAND);

  useEffect(() => {
    if (!uid) {
      setBrand(EMPTY_BRAND);
      return;
    }

    const projectsQuery = query(
      collection(db, "projects"),
      where("clientUserIds", "array-contains", uid)
    );

    return onSnapshot(
      projectsQuery,
      (snapshot) => {
        const projects = snapshot.docs
          .map((item) => item.data() as any)
          .filter((item) => item?.isArchived !== true)
          .sort((a, b) =>
            String(a.client || a.projectName || "").localeCompare(
              String(b.client || b.projectName || "")
            )
          );
        const brandedProject = projects.find(
          (item) => item.clientLogoUrl || item.clientLogo?.url
        );
        const identityProject = brandedProject || projects[0];

        setBrand({
          clientName: String(identityProject?.client || identityProject?.projectName || "Client"),
          logoUrl: String(identityProject?.clientLogoUrl || identityProject?.clientLogo?.url || ""),
        });
      },
      () => setBrand(EMPTY_BRAND)
    );
  }, [uid]);

  return brand;
}
