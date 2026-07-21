import { readJsonBody } from "@/lib/server/api/request";
import { createPartnerApiHandler } from "@/lib/server/partnerApi/routeHandler";
import { partnerBookingService } from "@/lib/server/partnerApi/services/PartnerBookingService";
import { validateCreateBookingBody } from "@/lib/server/partnerApi/validation/bookingValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createPartnerApiHandler({
  requiredScope: "bookings:create",
  async handler(ctx, req) {
    const body = await readJsonBody(req);
    const input = validateCreateBookingBody(body);
    const idempotencyKey = req.headers.get("idempotency-key") || "";
    const result = await partnerBookingService.createBooking(
      ctx,
      input,
      idempotencyKey
    );

    return {
      status: result.idempotentReplay ? 200 : 201,
      resourceId: result.booking.id,
      data: {
        booking: {
          id: result.booking.id,
          externalReference: result.booking.externalReference,
          status: result.booking.status,
        },
        idempotentReplay: result.idempotentReplay,
      },
    };
  },
});
