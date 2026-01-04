"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * usePermissions
 * ---------------
 * Loads permissions for a given role from Firestore:
 * roles/{role} → { permissions: { [key: string]: boolean } }
 *
 * @param role - user role (e.g. "admin", "dispatcher")
 */
export function usePermissions(role?: string) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔒 no role → no permissions
    if (typeof role !== "string" || role.trim() === "") {
      setPermissions({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPermissions = async () => {
      try {
        const ref = doc(db, "roles", role);
        const snap = await getDoc(ref);

        if (!cancelled) {
          if (snap.exists()) {
            setPermissions(
              (snap.data()?.permissions as Record<string, boolean>) || {}
            );
          } else {
            // role document not found
            setPermissions({});
          }
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
        if (!cancelled) {
          setPermissions({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [role]);

  return permissions;
}
