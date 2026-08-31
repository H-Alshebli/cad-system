import { NextRequest } from "next/server";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { getUserAccountType } from "@/lib/userAccounts";

export type EntitlementsActor = {
  uid: string;
  email: string;
  name: string;
  role: string;
  user: Record<string, any>;
  permissions: Record<string, boolean>;
  isAdmin: boolean;
};

function isAdminRole(role: string) {
  return ["admin", "super_admin", "superadmin"].includes(role.trim().toLowerCase());
}

export async function authenticateEntitlementsActor(request: NextRequest) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const snapshot = await adminDb.collection("users").doc(token.uid).get();
    if (!snapshot.exists) return null;
    const user = snapshot.data() || {};
    if (getUserAccountType(user) === "client") return null;

    const role = String(user.role || "").trim();
    const isAdmin = isAdminRole(role);
    let permissions: Record<string, boolean> = {};
    if (!isAdmin && role) {
      const roleSnapshot = await adminDb.collection("roles").doc(role).get();
      permissions = roleSnapshot.data()?.permissions?.employee_entitlements || {};
    }

    return {
      uid: token.uid,
      email: token.email || String(user.email || ""),
      name: String(user.name || user.displayName || token.email || "HCAD User"),
      role,
      user,
      permissions,
      isAdmin,
    } satisfies EntitlementsActor;
  } catch {
    return null;
  }
}

export function actorCan(actor: EntitlementsActor, action: string) {
  if (actor.isAdmin) return true;
  if ((action === "view_own" || action === "respond") && actor.permissions[action] !== false) {
    return true;
  }
  return actor.permissions[action] === true;
}
