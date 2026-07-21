import type { BaseEntity } from "@/lib/server/models/entity";

export type PartnerBookingStatus = "pending_review" | "cancelled" | "converted";

export type PartnerBooking = BaseEntity & {
  partnerId: string;
  externalReference: string;
  idempotencyKey: string;
  status: PartnerBookingStatus;
  patient: {
    name?: string;
    phone?: string;
    age?: number | null;
    gender?: string;
  };
  service: {
    type: string;
    requestedAt?: string;
    notes?: string;
  };
  pickup: {
    text: string;
    lat?: number | null;
    lng?: number | null;
  };
  destination?: {
    text?: string;
    lat?: number | null;
    lng?: number | null;
  };
  source: "partner_api_v1";
  createdVia: "partner_api";
};

export type CreatePartnerBookingInput = {
  externalReference: string;
  patient?: {
    name?: string;
    phone?: string;
    age?: number | null;
    gender?: string;
  };
  service: {
    type: string;
    requestedAt?: string;
    notes?: string;
  };
  pickup: {
    text: string;
    lat?: number | null;
    lng?: number | null;
  };
  destination?: {
    text?: string;
    lat?: number | null;
    lng?: number | null;
  };
};
