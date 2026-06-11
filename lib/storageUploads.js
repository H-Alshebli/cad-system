import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

function safeFileName(fileName) {
  return String(fileName || "file")
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-]/g, "");
}

export async function uploadB2CMedicalReports(requestId, files) {
  if (!requestId) {
    throw new Error("Request ID is required before uploading files.");
  }

  if (!files || files.length === 0) {
    return [];
  }

  const uploadedFiles = await Promise.all(
    files.map(async (file) => {
      const fileName = `${Date.now()}_${safeFileName(file.name)}`;
      const path = `b2c-medical-reports/${requestId}/${fileName}`;
      const fileRef = ref(storage, path);

      await uploadBytes(fileRef, file, {
        contentType: file.type || "application/octet-stream",
      });

      const url = await getDownloadURL(fileRef);

      return {
        name: file.name,
        url,
        path,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      };
    })
  );

  return uploadedFiles;
}