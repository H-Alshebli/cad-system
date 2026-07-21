export type HcadEnvironment = "local" | "sandbox" | "production";

function normalizeEnvironment(value?: string): HcadEnvironment | null {
  const normalized = String(value || "").trim().toLowerCase();

  if (["local", "development", "dev"].includes(normalized)) return "local";
  if (["sandbox", "staging", "stage", "preview"].includes(normalized)) {
    return "sandbox";
  }
  if (["production", "prod"].includes(normalized)) return "production";

  return null;
}

export function getHcadEnvironment(): HcadEnvironment {
  return (
    normalizeEnvironment(process.env.NEXT_PUBLIC_HCAD_ENV) ||
    normalizeEnvironment(process.env.NEXT_PUBLIC_ENV) ||
    normalizeEnvironment(process.env.NODE_ENV) ||
    "local"
  );
}

export function isSandboxEnvironment() {
  return getHcadEnvironment() === "sandbox";
}

export function getEnvironmentLabel() {
  const env = getHcadEnvironment();

  if (env === "production") return "Production";
  if (env === "sandbox") return "Sandbox";

  return "Local Development";
}

function validatePublicEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getFirebaseConfigFromEnv() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  return {
    ...firebaseConfig,
    apiKey: validatePublicEnv(
      firebaseConfig.apiKey,
      "NEXT_PUBLIC_FIREBASE_API_KEY"
    ),
    authDomain: validatePublicEnv(
      firebaseConfig.authDomain,
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    ),
    projectId: validatePublicEnv(
      firebaseConfig.projectId,
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    ),
    storageBucket: validatePublicEnv(
      firebaseConfig.storageBucket,
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    ),
    messagingSenderId: validatePublicEnv(
      firebaseConfig.messagingSenderId,
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    ),
    appId: validatePublicEnv(
      firebaseConfig.appId,
      "NEXT_PUBLIC_FIREBASE_APP_ID"
    ),
  };
}
