// lib/usePermissions.ts
"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function usePermissions(roleId?: string) {
  const [permissions, setPermissions] = useState<any>({});

  useEffect(() => {
    // 👇 حوّل roleId إلى متغير محلي مؤكد
    if (typeof roleId !== "string") {
      setPermissions({});
      return;
    }

    const roleIdSafe: string = roleId;

    const loadPermissions = async () => {
      const ref = doc(db, "roles", roleIdSafe); // ✅ TypeScript راضي
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setPermissions(snap.data().permissions || {});
      } else {
        setPermissions({});
      }
    };

    loadPermissions();
  }, [roleId]);

  return permissions;
}
