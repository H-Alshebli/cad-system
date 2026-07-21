import { ApiError } from "@/lib/server/errors/ApiError";

const ALLOWED_PROTOCOLS = new Set(["https:"]);
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function validateSandboxWebhookDestination(destinationUrl?: string) {
  if (!destinationUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(destinationUrl);
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field: "destinationUrl", message: "Invalid URL." },
    ]);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field: "destinationUrl", message: "Only HTTPS destinations are allowed." },
    ]);
  }

  if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
      { field: "destinationUrl", message: "Local network destinations are not allowed." },
    ]);
  }

  const allowedHosts = (process.env.HCAD_SANDBOX_WEBHOOK_ALLOWED_HOSTS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowedHosts.length && !allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new ApiError(403, "FORBIDDEN", "Webhook destination is not allowed.");
  }

  return parsed.toString();
}
