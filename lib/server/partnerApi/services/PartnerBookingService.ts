import { ApiError } from "@/lib/server/errors/ApiError";
import type { ServiceContext } from "@/lib/server/services/serviceContext";
import type { CreatePartnerBookingInput } from "@/lib/server/partnerApi/models/PartnerBooking";
import type { PartnerBookingRepository } from "@/lib/server/partnerApi/repositories/PartnerBookingRepository";
import { partnerBookingRepository } from "@/lib/server/partnerApi/repositories/FirestorePartnerBookingRepository";

export class PartnerBookingService {
  constructor(
    private readonly repository: PartnerBookingRepository =
      partnerBookingRepository
  ) {}

  async createBooking(
    ctx: ServiceContext,
    input: CreatePartnerBookingInput,
    idempotencyKey: string
  ) {
    if (!ctx.partner) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    }

    if (!idempotencyKey.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "The request could not be processed.", [
        {
          field: "Idempotency-Key",
          message: "This header is required.",
        },
      ]);
    }

    return this.repository.createPendingBooking(input, {
      partnerId: ctx.partner.partnerId,
      idempotencyKey: idempotencyKey.trim(),
    });
  }

  async getBooking(ctx: ServiceContext, bookingId: string) {
    if (!ctx.partner) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const booking = await this.repository.getOwnedBooking(
      ctx.partner.partnerId,
      bookingId
    );

    if (!booking) {
      throw new ApiError(404, "NOT_FOUND", "The requested booking was not found.");
    }

    return booking;
  }

  async getBookingStatus(ctx: ServiceContext, bookingId: string) {
    const booking = await this.getBooking(ctx, bookingId);

    return {
      id: booking.id,
      externalReference: booking.externalReference,
      status: booking.status,
    };
  }
}

export const partnerBookingService = new PartnerBookingService();
