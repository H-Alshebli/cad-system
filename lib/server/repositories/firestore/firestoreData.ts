import { FieldValue } from "firebase-admin/firestore";

export function cleanUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanUndefinedDeep);
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val !== undefined) {
        cleaned[key] = cleanUndefinedDeep(val);
      }
    });

    return cleaned;
  }

  return value;
}

export function withCreateTimestamps<T extends Record<string, unknown>>(
  data: T
) {
  return {
    ...data,
    createdAt: data.createdAt ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export function withUpdateTimestamp<T extends Record<string, unknown>>(
  data: T
) {
  return {
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  };
}
