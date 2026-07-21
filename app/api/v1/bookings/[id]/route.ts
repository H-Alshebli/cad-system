import { createPartnerApiHandler } from "@/lib/server/partnerApi/routeHandler";
import { partnerBookingService } from "@/lib/server/partnerApi/services/PartnerBookingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPartnerApiHandler({
  requiredScope: "bookings:read",
  async handler(ctx, _req, route) {
    const booking = await partnerBookingService.getBooking(
      ctx,
      route.params?.id || ""
    );

    return {
      resourceId: booking.id,
      data: {
        booking: {
          id: booking.id,
          externalReference: booking.externalReference,
          status: booking.status,
          patient: booking.patient,
          service: booking.service,
          pickup: booking.pickup,
          destination: booking.destination,
        },
      },
    };
  },
});
