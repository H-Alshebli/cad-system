"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type PermissionsMap = {
  [module: string]: {
    [action: string]: boolean;
  };
};

export function usePermissions(role?: string) {
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔒 مهم جدًا: TypeScript Narrowing
    if (typeof role !== "string" || role.trim() === "") {
      setPermissions({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPermissions(currentRole: string) {
      try {
        const ref = doc(db, "roles", currentRole); // ✅ الآن آمن
        const snap = await getDoc(ref);

        if (!cancelled) {
          if (snap.exists()) {
            setPermissions(
              (snap.data()?.permissions as PermissionsMap) || {}
            );
          } else {
            setPermissions({});
          }
        }
      } catch (err) {
        console.error("❌ Failed to load permissions:", err);
        if (!cancelled) setPermissions({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPermissions(role); // ✅ role هنا مضمون string

    return () => {
      cancelled = true;
    };
  }, [role]);

  return { permissions, loading };
}
