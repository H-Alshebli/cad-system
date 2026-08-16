import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { CREW_PROFILE_SECTIONS } from "@/lib/crewProfile";
import { adminAuth, adminDb, getAdminStorageBucket } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CREW_ATTACHMENT_KEYS = new Set(
  CREW_PROFILE_SECTIONS.flatMap((section) =>
    section.fields.filter((field) => field.type === "file").map((field) => field.key)
  )
);

function safeFileName(fileName: string) {
  const cleaned = String(fileName || "file")
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-]/g, "")
    .replace(/^\.+/, "")
    .slice(-180);
  return cleaned || "file";
}

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

async function buildObjectPath(form: FormData, uid: string, fileName: string) {
  const category = String(form.get("category") || "");
  const uniqueName = `${Date.now()}_${randomUUID()}_${safeFileName(fileName)}`;

  if (category === "crew-profile") {
    const fieldKey = String(form.get("fieldKey") || "");
    if (!CREW_ATTACHMENT_KEYS.has(fieldKey)) return null;
    return `crew-profiles/${uid}/${fieldKey}/${uniqueName}`;
  }

  if (category === "b2c-medical-report") {
    const requestId = String(form.get("requestId") || "");
    if (!SEGMENT_PATTERN.test(requestId)) return null;
    const requestSnapshot = await adminDb.collection("b2cRequests").doc(requestId).get();
    if (!requestSnapshot.exists) return null;
    return `b2c-medical-reports/${requestId}/${uniqueName}`;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A non-empty file is required." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Files must be 25 MB or smaller." }, { status: 413 });
    }

    const path = await buildObjectPath(form, user.uid, file.name);
    if (!path) {
      return NextResponse.json({ error: "Invalid upload destination." }, { status: 400 });
    }

    const bucket = getAdminStorageBucket();
    const object = bucket.file(path);
    const downloadToken = randomUUID();
    const contentType = file.type || "application/octet-stream";

    await object.save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "private, max-age=0, no-transform",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedBy: user.uid,
        },
      },
    });

    const encodedPath = encodeURIComponent(path);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({
      file: {
        name: file.name,
        url,
        path,
        bucket: bucket.name,
        contentType,
        size: file.size,
      },
    });
  } catch (error) {
    console.error("Server-side Storage upload failed", error);
    return NextResponse.json({ error: "Could not upload the file." }, { status: 500 });
  }
}
