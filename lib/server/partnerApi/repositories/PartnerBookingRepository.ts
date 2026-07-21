import type {
  CreatePartnerBookingInput,
  PartnerBooking,
} from "@/lib/server/partnerApi/models/PartnerBooking";

export type CreatePartnerBookingOptions = {
  partnerId: string;
  idempotencyKey: string;
};

export type CreatePartnerBookingResult = {
  booking: PartnerBooking;
  idempotentReplay: boolean;
};

export type PartnerBookingRepository = {
  createPendingBooking(
    input: CreatePartnerBookingInput,
    options: CreatePartnerBookingOptions
  ): Promise<CreatePartnerBookingResult>;

  getOwnedBooking(
    partnerId: string,
    bookingId: string
  ): Promise<PartnerBooking | null>;
};
