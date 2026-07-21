import { getHcadEnvironment } from "@/lib/environment";
import { getOrCreateRequestId } from "@/lib/server/api/request";
import { successResponse } from "@/lib/server/api/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req);

  return successResponse(requestId, {
    service: "hcad-partner-api",
    version: "v1",
    environment: getHcadEnvironment(),
    status: "ok",
  });
}
