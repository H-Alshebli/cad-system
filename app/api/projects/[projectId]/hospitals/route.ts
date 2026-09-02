import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { getUserAccountType } from "@/lib/userAccounts";

export const runtime = "nodejs";

function text(value: unknown) { return String(value ?? "").trim(); }

function allowedGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (url.protocol === "https:" || url.protocol === "http:") && (host === "maps.app.goo.gl" || host === "goo.gl" || host === "google.com" || host.endsWith(".google.com"));
  } catch { return false; }
}

function coordinatesFromUrl(value: string) {
  const decoded = decodeURIComponent(value);
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]); const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

async function resolveGoogleMapsLink(value: string) {
  if (!allowedGoogleMapsUrl(value)) throw new Error("Use a valid Google Maps link.");
  let current = value;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const direct = coordinatesFromUrl(current);
    if (direct) return { ...direct, resolvedUrl: current };
    const response = await fetch(current, { method: "GET", redirect: "manual", headers: { "user-agent": "Mozilla/5.0 HCAD Location Resolver" }, cache: "no-store" });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location) break;
    const next = new URL(location, current).toString();
    if (!allowedGoogleMapsUrl(next)) throw new Error("Google Maps redirected to an unsupported address.");
    current = next;
  }
  const coordinates = coordinatesFromUrl(current);
  if (!coordinates) throw new Error("Coordinates could not be read from this Google Maps link.");
  return { ...coordinates, resolvedUrl: current };
}

async function authorizedActor(request: NextRequest) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const userSnapshot = await adminDb.collection("users").doc(token.uid).get();
    if (!userSnapshot.exists) return null;
    const user = userSnapshot.data() || {};
    if (user.active === false || getUserAccountType(user) === "client") return null;
    const role = text(user.role);
    const admin = ["admin", "super_admin", "superadmin"].includes(role.toLowerCase());
    if (admin) return { uid: token.uid, name: text(user.name || user.displayName || token.email) };
    const roleSnapshot = role ? await adminDb.collection("roles").doc(role).get() : null;
    return roleSnapshot?.data()?.permissions?.projects?.edit === true ? { uid: token.uid, name: text(user.name || user.displayName || token.email) } : null;
  } catch { return null; }
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const actor = await authorizedActor(request);
  if (!actor) return NextResponse.json({ error: "Project edit permission is required." }, { status: 403 });
  const projectId = text(params.projectId);
  const body = await request.json().catch(() => ({}));
  const name = text(body.name);
  const googleMapLink = text(body.googleMapLink);
  if (!projectId || !name || !googleMapLink) return NextResponse.json({ error: "Hospital name and Google Maps link are required." }, { status: 400 });

  try {
    const location = await resolveGoogleMapsLink(googleMapLink);
    const projectRef = adminDb.collection("projects").doc(projectId);
    const projectSnapshot = await projectRef.get();
    if (!projectSnapshot.exists) return NextResponse.json({ error: "Project was not found." }, { status: 404 });

    const existing = await adminDb.collection("destinations").where("name", "==", name).limit(1).get();
    const destinationRef = existing.empty ? adminDb.collection("destinations").doc() : existing.docs[0].ref;
    const hospital = { id: destinationRef.id, name, address: "", type: "hospital", lat: location.lat, lng: location.lng, googleMapLink: location.resolvedUrl, archived: false };

    await adminDb.runTransaction(async (transaction) => {
      const freshProject = await transaction.get(projectRef);
      const project = freshProject.data() || {};
      const ids = Array.from(new Set([...(Array.isArray(project.projectHospitalIds) ? project.projectHospitalIds : []), destinationRef.id]));
      const hospitals = [...(Array.isArray(project.projectHospitals) ? project.projectHospitals : []).filter((item: any) => item?.id !== destinationRef.id), hospital];
      transaction.set(destinationRef, { ...hospital, createdFromProjectId: projectId, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid, ...(!existing.empty ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: actor.uid }) }, { merge: true });
      transaction.update(projectRef, { projectHospitalIds: ids, projectHospitals: hospitals, updatedAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ hospital });
  } catch (error) {
    console.error("Could not add project hospital", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The hospital could not be added." }, { status: 400 });
  }
}
