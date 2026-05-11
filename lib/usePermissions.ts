"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  PERMISSION_MATRIX,
  PermissionsMap,
  normalizePermissions,
} from "@/lib/permissionsMatrix";

export type PermissionCheck = (
  module: string,
  action?: string
) => boolean;

function normalizeRole(role?: string | null) {
  return String(role || "").trim();
}

function isAdminRole(role?: string | null) {
  const normalized = normalizeRole(role).toLowerCase();

  return (
    normalized === "admin" ||
    normalized === "super_admin" ||
    normalized === "superadmin"
  );
}

function buildAdminPermissions(): PermissionsMap {
  const fullPermissions: PermissionsMap = {};

  Object.entries(PERMISSION_MATRIX).forEach(([module, actions]) => {
    fullPermissions[module] = {};

    actions.forEach((action) => {
      fullPermissions[module][action] = true;
    });
  });

  return normalizePermissions(fullPermissions);
}

export function hasPermission(
  permissions: PermissionsMap,
  module: string,
  action: string = "view",
  role?: string | null
) {
  if (isAdminRole(role)) return true;

  return Boolean(permissions?.[module]?.[action]);
}

export function can(
  permissions: PermissionsMap,
  module: string,
  action: string = "view",
  role?: string | null
) {
  return hasPermission(permissions, module, action, role);
}

export function usePermissions(role?: string | null) {
  const [permissions, setPermissions] = useState<PermissionsMap>(
    normalizePermissions({})
  );
  const [loading, setLoading] = useState(true);

  const roleId = normalizeRole(role);
  const isAdmin = isAdminRole(roleId);

  useEffect(() => {
    if (!roleId || roleId === "none") {
      setPermissions(normalizePermissions({}));
      setLoading(false);
      return;
    }

    if (isAdmin) {
      setPermissions(buildAdminPermissions());
      setLoading(false);
      return;
    }

    setLoading(true);

    // IMPORTANT:
    // Use the exact role name as saved in Firestore.
    // Example: roles / Sales Dep
    const ref = doc(db, "roles", roleId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPermissions(normalizePermissions(data.permissions || {}));
        } else {
          console.warn(`Role permissions not found for role: ${roleId}`);
          setPermissions(normalizePermissions({}));
        }

        setLoading(false);
      },
      (error) => {
        console.error("Failed to load permissions:", error);
        setPermissions(normalizePermissions({}));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [roleId, isAdmin]);

  const checkPermission: PermissionCheck = useMemo(() => {
    return (module: string, action: string = "view") =>
      hasPermission(permissions, module, action, roleId);
  }, [permissions, roleId]);

  return {
    permissions,
    loading,
    isAdmin,
    can: checkPermission,
  };
}