import type { AuthenticatedPartner } from "@/lib/server/partners/types";

export type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      retryAfterSeconds?: number;
    };

export type RateLimiter = {
  check(partner: AuthenticatedPartner, req: Request): Promise<RateLimitResult>;
};

export class NoopRateLimiter implements RateLimiter {
  async check(
    _partner: AuthenticatedPartner,
    _req: Request
  ): Promise<RateLimitResult> {
    return { ok: true };
  }
}

export const rateLimiter: RateLimiter = new NoopRateLimiter();
