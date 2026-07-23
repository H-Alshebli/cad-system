import { existsSync, readFileSync } from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createPrivateKey } from "crypto";

export type SeedSource = "hcad-system-seed" | "hcad-demo-seed";

export type SeedDocument = {
  collection: string;
  id: string;
  data: Record<string, unknown>;
  seedSource: SeedSource;
  description: string;
};

type SeedMode = "system" | "demo";

type SeedContext = {
  apply: boolean;
  seedEnv: string;
  projectId: string;
  allowedProjectIds: string[];
  productionProjectIds: string[];
  serviceAccountPath?: string;
  serviceAccount?: ServiceAccountConfig;
};

type SeedCounts = {
  planned: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

const SAFE_SEED_ENVS = new Set([
  "sandbox",
  "demo",
  "development",
  "dev",
  "uat",
  "local",
]);

const SEED_VERSION = "1.0";
const ENV_FILES = [".env.seed", ".env.local", ".env.production"];
const REQUIRED_SANDBOX_PROJECT_ID = "lazem-hcad-sandbox";

type ServiceAccountConfig = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) return;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

export function loadSeedEnvFiles() {
  ENV_FILES.forEach(parseEnvFile);
}

function getArg(name: string) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function splitCsv(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readServiceAccount(path?: string): ServiceAccountConfig | undefined {
  const serviceAccountPath = String(path || "").trim();
  if (!serviceAccountPath) return undefined;

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Seed refused: FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH file was not found.`
    );
  }

  try {
    return JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  } catch {
    throw new Error(
      "Seed refused: FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH could not be parsed as JSON."
    );
  }
}

function serviceAccountPrivateKeyParses(serviceAccount: ServiceAccountConfig) {
  if (!serviceAccount.private_key) return false;

  try {
    createPrivateKey(serviceAccount.private_key);
    return true;
  } catch {
    return false;
  }
}

function maskProjectList(values: string[]) {
  return values.length ? values.join(", ") : "(none configured)";
}

export function getSeedContext(mode: SeedMode): SeedContext {
  loadSeedEnvFiles();

  const apply = process.argv.includes("--apply");
  const seedEnv = String(
    getArg("--env") ||
      process.env.HCAD_SEED_ENV ||
      process.env.NEXT_PUBLIC_HCAD_ENV ||
      process.env.NEXT_PUBLIC_ENV ||
      ""
  )
    .trim()
    .toLowerCase();
  const projectId = String(
    getArg("--project-id") ||
      readServiceAccount(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH)
        ?.project_id ||
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      ""
  ).trim();
  const serviceAccountPath = String(
    getArg("--service-account-path") ||
      process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH ||
      ""
  ).trim();
  const serviceAccount = readServiceAccount(serviceAccountPath);
  const allowedProjectIds = splitCsv(
    getArg("--allowed-project-ids") ||
      process.env.HCAD_SEED_ALLOWED_PROJECT_IDS
  );
  const productionProjectIds = splitCsv(
    process.env.HCAD_SEED_PRODUCTION_PROJECT_IDS ||
      process.env.HCAD_PRODUCTION_FIREBASE_PROJECT_IDS
  );

  const context = {
    apply,
    seedEnv,
    projectId,
    allowedProjectIds,
    productionProjectIds,
    serviceAccountPath: serviceAccountPath || undefined,
    serviceAccount,
  };

  validateSeedSafety(context, mode);
  return context;
}

function validateSeedSafety(context: SeedContext, mode: SeedMode) {
  if (!context.seedEnv || !SAFE_SEED_ENVS.has(context.seedEnv)) {
    throw new Error(
      `Seed refused: HCAD_SEED_ENV must be one of ${Array.from(
        SAFE_SEED_ENVS
      ).join(", ")}. Current value: ${context.seedEnv || "(empty)"}`
    );
  }

  if (!context.projectId) {
    throw new Error(
      "Seed refused: FIREBASE_ADMIN_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID is required."
    );
  }

  if (!context.allowedProjectIds.length) {
    throw new Error(
      "Seed refused: HCAD_SEED_ALLOWED_PROJECT_IDS must include the Sandbox/Demo project ID."
    );
  }

  if (!context.allowedProjectIds.includes(context.projectId)) {
    throw new Error(
      `Seed refused: project ${context.projectId} is not in HCAD_SEED_ALLOWED_PROJECT_IDS (${maskProjectList(
        context.allowedProjectIds
      )}).`
    );
  }

  if (context.productionProjectIds.includes(context.projectId)) {
    throw new Error(
      `Seed refused: project ${context.projectId} is listed as a production project.`
    );
  }

  if (context.serviceAccountPath) {
    validateServiceAccount(context);
  }

  if (mode === "demo" && context.seedEnv === "local") {
    throw new Error(
      "Demo seed refused: use sandbox, demo, development, dev, or uat for HCAD_SEED_ENV."
    );
  }
}

function validateServiceAccount(context: SeedContext) {
  const serviceAccount = context.serviceAccount;

  if (!serviceAccount?.project_id) {
    throw new Error("Seed refused: service account project_id is required.");
  }

  if (!serviceAccount.client_email) {
    throw new Error("Seed refused: service account client_email is required.");
  }

  if (!serviceAccount.private_key) {
    throw new Error("Seed refused: service account private_key is required.");
  }

  if (serviceAccount.project_id === "lazem-dispatch") {
    throw new Error("Seed refused: production project ID is not allowed.");
  }

  if (serviceAccount.project_id !== REQUIRED_SANDBOX_PROJECT_ID) {
    throw new Error(
      `Seed refused: service account project_id must be ${REQUIRED_SANDBOX_PROJECT_ID}.`
    );
  }

  if (serviceAccount.project_id !== context.projectId) {
    throw new Error(
      "Seed refused: service account project_id must match the selected seed project ID."
    );
  }

  const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!publicProjectId) {
    throw new Error("Seed refused: NEXT_PUBLIC_FIREBASE_PROJECT_ID is required.");
  }

  if (publicProjectId !== serviceAccount.project_id) {
    throw new Error(
      "Seed refused: service account project_id must match NEXT_PUBLIC_FIREBASE_PROJECT_ID."
    );
  }

  if (
    !serviceAccount.client_email.endsWith(
      `@${serviceAccount.project_id}.iam.gserviceaccount.com`
    )
  ) {
    throw new Error(
      "Seed refused: service account client_email must belong to the Sandbox Firebase project."
    );
  }

  if (!context.allowedProjectIds.includes(serviceAccount.project_id)) {
    throw new Error(
      "Seed refused: service account project_id must be included in HCAD_SEED_ALLOWED_PROJECT_IDS."
    );
  }

  if (context.productionProjectIds.includes(serviceAccount.project_id)) {
    throw new Error(
      "Seed refused: service account project_id is listed as a production project."
    );
  }

  if (!serviceAccountPrivateKeyParses(serviceAccount)) {
    throw new Error("Seed refused: service account private_key is not parseable.");
  }
}

function getAdminDb(context: SeedContext) {
  if (!getApps().length) {
    const serviceAccount = context.serviceAccount;
    const clientEmail =
      serviceAccount?.client_email || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey =
      serviceAccount?.private_key ||
      process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
      throw new Error(
        "Apply refused: FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY are required for writes."
      );
    }

    initializeApp({
      credential: cert({
        projectId: context.projectId,
        clientEmail,
        privateKey,
      }),
      projectId: context.projectId,
    });
  }

  return getFirestore();
}

function withSeedMetadata(document: SeedDocument) {
  const demoMetadata =
    document.seedSource === "hcad-demo-seed"
      ? {
          environment: "sandbox",
          isDemo: true,
        }
      : {};

  return {
    ...document.data,
    ...demoMetadata,
    seedSource: document.seedSource,
    seedVersion: SEED_VERSION,
    seedUpdatedAt: FieldValue.serverTimestamp(),
  };
}

function printPlan(documents: SeedDocument[], context: SeedContext) {
  console.log(
    `[hcad-seed] mode=${context.apply ? "apply" : "dry-run"} env=${
      context.seedEnv
    } project=${context.projectId}`
  );
  console.log(`[hcad-seed] documents planned: ${documents.length}`);

  documents.forEach((document) => {
    console.log(
      `- ${document.collection}/${document.id} (${document.seedSource}) ${document.description}`
    );
  });
}

export async function runSeed(
  mode: SeedMode,
  documents: SeedDocument[]
): Promise<SeedCounts> {
  const context = getSeedContext(mode);
  const counts: SeedCounts = {
    planned: documents.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  printPlan(documents, context);

  if (!context.apply) {
    console.log("[hcad-seed] dry-run only. No Firebase writes were made.");
    return counts;
  }

  const db = getAdminDb(context);

  for (const document of documents) {
    try {
      const ref = db.collection(document.collection).doc(document.id);
      const snap = await ref.get();

      if (snap.exists) {
        const existing = snap.data() || {};
        if (existing.seedSource && existing.seedSource !== document.seedSource) {
          counts.skipped += 1;
          console.log(
            `[hcad-seed] skipped ${document.collection}/${document.id}: managed by ${existing.seedSource}`
          );
          continue;
        }

        if (!existing.seedSource) {
          counts.skipped += 1;
          console.log(
            `[hcad-seed] skipped ${document.collection}/${document.id}: existing non-seed document`
          );
          continue;
        }

        await ref.set(withSeedMetadata(document), { merge: true });
        counts.updated += 1;
        console.log(`[hcad-seed] updated ${document.collection}/${document.id}`);
        continue;
      }

      await ref.set({
        ...withSeedMetadata(document),
        seedCreatedAt: FieldValue.serverTimestamp(),
      });
      counts.created += 1;
      console.log(`[hcad-seed] created ${document.collection}/${document.id}`);
    } catch (error) {
      counts.failed += 1;
      console.error(
        `[hcad-seed] failed ${document.collection}/${document.id}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  console.log(
    `[hcad-seed] complete planned=${counts.planned} created=${counts.created} updated=${counts.updated} skipped=${counts.skipped} failed=${counts.failed}`
  );

  return counts;
}
