import { ApiError } from "@/lib/server/errors/ApiError";
import type { CreatePartnerBookingInput } from "@/lib/server/partnerApi/models/PartnerBooking";

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  "externalReference",
  "patient",
  "service",
  "pickup",
  "destination",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rejectUnknownFields(body: Record<string, unknown>) {
  const unknownFields = Object.keys(body).filter(
    (key) => !ALLOWED_TOP_LEVEL_FIELDS.has(key)
  );

  if (unknownFields.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      {
        field: "body",
        message: `Unsupported field(s): ${unknownFields.join(", ")}`,
      },
    ]);
  }
}

function getString(
  source: Record<string, unknown>,
  field: string,
  required = false
) {
  const value = source[field];

  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
        { field, message: "This field is required." },
      ]);
    }

    return "";
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field, message: "Expected a string." },
    ]);
  }

  return value.trim();
}

function getNumberOrNull(source: Record<string, unknown>, field: string) {
  const value = source[field];

  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field, message: "Expected a number." },
    ]);
  }

  return value;
}

function optionalObject(
  body: Record<string, unknown>,
  field: string
): Record<string, unknown> {
  const value = body[field];

  if (value === undefined || value === null) return {};
  if (!isObject(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field, message: "Expected an object." },
    ]);
  }

  return value;
}

function requiredObject(
  body: Record<string, unknown>,
  field: string
): Record<string, unknown> {
  const value = body[field];

  if (!isObject(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field, message: "This object is required." },
    ]);
  }

  return value;
}

export function validateCreateBookingBody(body: unknown): CreatePartnerBookingInput {
  if (!isObject(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field: "body", message: "Expected a JSON object." },
    ]);
  }

  rejectUnknownFields(body);

  const patient = optionalObject(body, "patient");
  const service = requiredObject(body, "service");
  const pickup = requiredObject(body, "pickup");
  const destination = optionalObject(body, "destination");

  return {
    externalReference: getString(body, "externalReference", true),
    patient: {
      name: getString(patient, "name"),
      phone: getString(patient, "phone"),
      age: getNumberOrNull(patient, "age"),
      gender: getString(patient, "gender"),
    },
    service: {
      type: getString(service, "type", true),
      requestedAt: getString(service, "requestedAt"),
      notes: getString(service, "notes"),
    },
    pickup: {
      text: getString(pickup, "text", true),
      lat: getNumberOrNull(pickup, "lat"),
      lng: getNumberOrNull(pickup, "lng"),
    },
    destination: Object.keys(destination).length
      ? {
          text: getString(destination, "text"),
          lat: getNumberOrNull(destination, "lat"),
          lng: getNumberOrNull(destination, "lng"),
        }
      : undefined,
  };
}
