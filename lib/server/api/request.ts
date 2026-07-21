import { randomUUID } from "crypto";

export function getOrCreateRequestId(req: Request) {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    randomUUID()
  );
}

export function getEndpointPath(req: Request) {
  return new URL(req.url).pathname;
}

export async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
