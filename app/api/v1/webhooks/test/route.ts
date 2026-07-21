import { readJsonBody } from "@/lib/server/api/request";
import { createPartnerApiHandler } from "@/lib/server/partnerApi/routeHandler";
import { validateSandboxWebhookDestination } from "@/lib/server/partnerApi/services/WebhookTestService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createPartnerApiHandler({
  requiredScope: "webhooks:test",
  async handler(_ctx, req) {
    const body = await readJsonBody(req);
    const destinationUrl =
      body && typeof body === "object" && "destinationUrl" in body
        ? String((body as any).destinationUrl || "")
        : "";
    const validatedDestination =
      validateSandboxWebhookDestination(destinationUrl);

    return {
      data: {
        simulated: true,
        delivered: false,
        destinationAccepted: Boolean(validatedDestination),
        message:
          "Webhook test accepted. Release 0 simulates delivery and does not contact production systems.",
      },
    };
  },
});
