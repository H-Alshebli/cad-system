import { auth } from "@/lib/firebase";

function safeFileName(fileName) {
  return String(fileName || "file")
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-]/g, "");
}

export async function uploadStorageFile(file, fields) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to upload files.");

  const token = await user.getIdToken();
  const body = new FormData();
  body.append("file", file, safeFileName(file.name));
  Object.entries(fields).forEach(([key, value]) => body.append(key, String(value)));

  const response = await fetch("/api/storage/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Could not upload the file.");
  }

  return result.file;
}

export async function uploadB2CMedicalReports(requestId, files) {
  if (!requestId) throw new Error("Request ID is required before uploading files.");
  if (!files || files.length === 0) return [];

  return Promise.all(
    files.map((file) => uploadStorageFile(file, { category: "b2c-medical-report", requestId }))
  );
}
