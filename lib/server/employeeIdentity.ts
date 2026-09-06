import { createHmac } from "crypto";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeEmployeeIdentity(value: unknown) {
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_DIGITS.indexOf(digit)))
    .replace(/\D/g, "");
}

export function isValidEmployeeIdentity(value: string) {
  return /^\d{10}$/.test(value);
}

export function hashEmployeeIdentity(value: string) {
  const secret =
    process.env.EMPLOYEE_IDENTITY_HASH_SECRET ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "hcad-local-identity-key";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function maskEmployeeIdentity(value: string) {
  return value ? `******${value.slice(-4)}` : "";
}
