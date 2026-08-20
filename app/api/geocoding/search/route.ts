import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1100;

type SearchResult = {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
};

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return await adminAuth.verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

async function search(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = String(request.nextUrl.searchParams.get("q") || "")
    .trim()
    .replace(/\s+/g, " ");

  if (query.length < 3 || query.length > 120) {
    return NextResponse.json(
      { error: "Enter a place or address between 3 and 120 characters." },
      { status: 400 }
    );
  }

  const cacheKey = createHash("sha256")
    .update(`sa:${query.toLocaleLowerCase("en-US")}`)
    .digest("hex");
  const cacheRef = adminDb.collection("geocodingCache").doc(cacheKey);
  const cached = await cacheRef.get();
  const cachedData = cached.data();
  const cachedResults = cachedData?.results;
  const expiresAt = cachedData?.expiresAt?.toMillis?.() || 0;

  if (cached.exists && expiresAt > Date.now() && Array.isArray(cachedResults)) {
    return NextResponse.json({ results: cachedResults, cached: true });
  }

  const rateLimitRef = adminDb.collection("systemRateLimits").doc("nominatim");
  const now = Date.now();

  try {
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(rateLimitRef);
      const lastRequestAt = snapshot.data()?.lastRequestAt?.toMillis?.() || 0;

      if (now - lastRequestAt < MIN_REQUEST_INTERVAL_MS) {
        throw new Error("RATE_LIMITED");
      }

      transaction.set(
        rateLimitRef,
        { lastRequestAt: Timestamp.fromMillis(now) },
        { merge: true }
      );
    });
  } catch (error: any) {
    if (error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Please wait a moment before searching again." },
        { status: 429 }
      );
    }
    throw error;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "sa");
  url.searchParams.set("limit", "5");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ar,en;q=0.8",
      "User-Agent": "Lazem-HCAD/1.0 (https://hcad.lazem.sa)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Location search is temporarily unavailable." },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as any[];
  const results: SearchResult[] = payload
    .map((item) => ({
      id: `${item.osm_type || "place"}-${item.osm_id || item.place_id}`,
      displayName: String(item.display_name || ""),
      lat: Number(item.lat),
      lng: Number(item.lon),
    }))
    .filter(
      (item) =>
        item.displayName && Number.isFinite(item.lat) && Number.isFinite(item.lng)
    );

  await cacheRef.set({
    results,
    expiresAt: Timestamp.fromMillis(Date.now() + CACHE_DURATION_MS),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ results, cached: false });
}

export async function GET(request: NextRequest) {
  try {
    return await search(request);
  } catch (error) {
    console.error("Location search request failed", error);
    return NextResponse.json(
      { error: "Location search is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
