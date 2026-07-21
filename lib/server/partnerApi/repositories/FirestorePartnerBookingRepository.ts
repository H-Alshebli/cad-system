import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/server/firebaseAdmin";
import type { PartnerBooking } from "@/lib/server/partnerApi/models/PartnerBooking";
import type {
  CreatePartnerBookingOptions,
  CreatePartnerBookingResult,
  PartnerBookingRepository,
} from "@/lib/server/partnerApi/repositories/PartnerBookingRepository";
import type { CreatePartnerBookingInput } from "@/lib/server/partnerApi/models/PartnerBooking";
import { repositoryFactory } from "@/lib/server/repositories/factory/repositoryFactory";
import { ApiError } from "@/lib/server/errors/ApiError";

const BOOKING_COLLECTION = "partnerBookings";
const IDEMPOTENCY_COLLECTION = "partnerBookingIdempotency";

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function idempotencyDocumentId(partnerId: string, idempotencyKey: string) {
  return createHash("sha256")
    .update(`${partnerId}:${idempotencyKey}`)
    .digest("hex");
}

function toBooking(id: string, data: FirebaseFirestore.DocumentData): PartnerBooking {
  return {
    id,
    ...data,
  } as PartnerBooking;
}

export class FirestorePartnerBookingRepository
  implements PartnerBookingRepository
{
  private readonly bookings =
    repositoryFactory.forCollection<PartnerBooking>(BOOKING_COLLECTION);

  async createPendingBooking(
    input: CreatePartnerBookingInput,
    options: CreatePartnerBookingOptions
  ): Promise<CreatePartnerBookingResult> {
    const requestHash = stableHash(input);
    const idempotencyId = idempotencyDocumentId(
      options.partnerId,
      options.idempotencyKey
    );
    const idempotencyRef = adminDb
      .collection(IDEMPOTENCY_COLLECTION)
      .doc(idempotencyId);
    const bookingRef = adminDb.collection(BOOKING_COLLECTION).doc();

    const result = await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(idempotencyRef);

      if (existing.exists) {
        const existingData = existing.data() || {};

        if (existingData.requestHash !== requestHash) {
          throw new ApiError(
            409,
            "CONFLICT",
            "The idempotency key was already used with a different request."
          );
        }

        const existingBookingSnap = await transaction.get(
          adminDb.collection(BOOKING_COLLECTION).doc(existingData.bookingId)
        );

        if (!existingBookingSnap.exists) {
          throw new ApiError(
            409,
            "CONFLICT",
            "The idempotency key points to a booking that is no longer available."
          );
        }

        return {
          booking: toBooking(existingBookingSnap.id, existingBookingSnap.data() || {}),
          idempotentReplay: true,
        };
      }

      const bookingPayload: Omit<PartnerBooking, "id"> = {
        partnerId: options.partnerId,
        externalReference: input.externalReference,
        idempotencyKey: options.idempotencyKey,
        status: "pending_review",
        patient: input.patient || {},
        service: input.service,
        pickup: input.pickup,
        destination: input.destination,
        source: "partner_api_v1",
        createdVia: "partner_api",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(bookingRef, bookingPayload);
      transaction.set(idempotencyRef, {
        partnerId: options.partnerId,
        idempotencyKeyHash: stableHash(options.idempotencyKey),
        requestHash,
        bookingId: bookingRef.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        booking: {
          id: bookingRef.id,
          ...bookingPayload,
        } as PartnerBooking,
        idempotentReplay: false,
      };
    });

    return result as CreatePartnerBookingResult;
  }

  async getOwnedBooking(partnerId: string, bookingId: string) {
    const booking = await this.bookings.getById(bookingId);

    if (!booking || booking.partnerId !== partnerId) {
      return null;
    }

    return booking;
  }
}

export const partnerBookingRepository =
  new FirestorePartnerBookingRepository();
