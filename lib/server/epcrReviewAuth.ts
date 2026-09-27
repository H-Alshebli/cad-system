import { adminAuth, adminDb } from "./firebaseAdmin";
import { normalizeRolePermissions } from "../permissionsMatrix";

export async function epcrActor(authorization: string | null) {
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!bearer) return null;
  try {
    const token = await adminAuth.verifyIdToken(bearer[1], true);
    const snapshot = await adminDb.collection("users").doc(token.uid).get();
    const user = snapshot.data();
    if (!user || user.active !== true || user.accountType === "client") return null;
    const role = String(user.role || "");
    const isAdmin = ["admin", "super_admin", "superadmin"].includes(role.toLowerCase().trim());
    const roleDoc = isAdmin ? null : await adminDb.collection("roles").doc(role).get();
    const permissions = normalizeRolePermissions(roleDoc?.data()?.permissions || {}, role);
    return { uid: token.uid, name: String(user.name || "Reviewer"), isAdmin,
      can: (module: string, action: string) => isAdmin || permissions[module]?.[action] === true };
  } catch { return null; }
}
