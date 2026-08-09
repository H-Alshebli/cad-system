import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export const adminApp = initializeAdminApp();
export const adminDb = getFirestore(adminApp);
