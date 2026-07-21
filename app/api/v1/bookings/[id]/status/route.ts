import { createPartnerApiHandler } from "@/lib/server/partnerApi/routeHandler";
import { partnerBookingService } from "@/lib/server/partnerApi/services/PartnerBookingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPartnerApiHandler({
  requiredScope: "bookings:status:read",
  async handler(ctx, _req, route) {
    const status = await partnerBookingService.getBookingStatus(
      ctx,
      route.params?.id || ""
    );

    return {
      resourceId: status.id,
      data: {
        booking: status,
      },
    };
  },
});
