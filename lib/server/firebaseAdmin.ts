import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getPrivateKey() {
  const rawValue = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").trim();
  if (!rawValue) return undefined;

  let privateKey = rawValue;

  // Accept a full Firebase service-account JSON object when it was pasted into
  // the Vercel variable instead of only the private_key property.
  if (privateKey.startsWith("{")) {
    try {
      const serviceAccount = JSON.parse(privateKey);
      privateKey = String(serviceAccount.private_key || "").trim();
    } catch {
      // Keep the original value so Firebase reports an invalid credential.
    }
  } else if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    // Accept a JSON-quoted private_key value copied directly from the file.
    try {
      privateKey = JSON.parse(privateKey);
    } catch {
      privateKey = privateKey.slice(1, -1);
    }
  }

  return privateKey.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").trim();
}

function initializeAdminApp() {
  if (getApps().length) {
    return getApps()[0];
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const adminApp = initializeAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

export function getAdminStorageBucket() {
  const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET || "").trim();

  if (!bucketName) {
    throw new Error("Missing required environment variable: FIREBASE_STORAGE_BUCKET");
  }

  return getStorage(adminApp).bucket(bucketName);
}
