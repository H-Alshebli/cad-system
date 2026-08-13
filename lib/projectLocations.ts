import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ProjectLocation = {
  id: string;
  siteNumber: string;
  siteName: string;
  coordinates: string;
  lat: number;
  lng: number;
  status: "active" | "archived";
  source: "excel" | "manual";
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectLocationInput = Pick<
  ProjectLocation,
  "siteNumber" | "siteName" | "coordinates" | "lat" | "lng"
>;

export function parseCoordinates(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng, normalized: `${lat}, ${lng}` };
}

export function getProjectLocationDocumentId(siteNumber: string) {
  return `site-${encodeURIComponent(siteNumber.trim())}`;
}

function normalizeStoredLocations(value: unknown): ProjectLocation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      ...item,
      id: item.id || getProjectLocationDocumentId(String(item.siteNumber || "")),
      status: item.status === "archived" ? "archived" : "active",
      source: item.source === "excel" ? "excel" : "manual",
    }));
}

async function getStoredLocations(projectId: string) {
  const snapshot = await getDoc(doc(db, "projects", projectId));
  if (!snapshot.exists()) throw new Error("Project not found.");
  return normalizeStoredLocations(snapshot.data().projectLocations);
}

async function writeStoredLocations(projectId: string, locations: ProjectLocation[]) {
  await updateDoc(doc(db, "projects", projectId), {
    projectLocations: locations,
    projectLocationsCount: locations.filter((item) => item.status !== "archived").length,
    projectLocationsUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveProjectLocation(
  projectId: string,
  input: ProjectLocationInput,
  source: "excel" | "manual" = "manual"
) {
  const locations = await getStoredLocations(projectId);
  const id = getProjectLocationDocumentId(input.siteNumber);
  const existingIndex = locations.findIndex((item) => item.id === id);
  const now = new Date().toISOString();
  const location: ProjectLocation = {
    ...input,
    id,
    status: "active",
    source,
    createdAt: existingIndex >= 0 ? locations[existingIndex].createdAt || now : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) locations[existingIndex] = location;
  else locations.push(location);
  await writeStoredLocations(projectId, locations);
}

export async function importProjectLocations(
  projectId: string,
  imported: ProjectLocationInput[]
) {
  const locations = await getStoredLocations(projectId);
  const byId = new Map(locations.map((item) => [item.id, item]));
  const now = new Date().toISOString();

  imported.forEach((input) => {
    const id = getProjectLocationDocumentId(input.siteNumber);
    const existing = byId.get(id);
    byId.set(id, {
      ...input,
      id,
      status: "active",
      source: "excel",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  });

  await writeStoredLocations(projectId, [...byId.values()]);
}

export async function archiveProjectLocation(projectId: string, locationId: string) {
  const locations = await getStoredLocations(projectId);
  const next = locations.map((item) =>
    item.id === locationId
      ? { ...item, status: "archived" as const, updatedAt: new Date().toISOString() }
      : item
  );
  await writeStoredLocations(projectId, next);
}

export function readProjectLocations(project: Record<string, any> | null | undefined) {
  return normalizeStoredLocations(project?.projectLocations);
}
