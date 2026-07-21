import { createHash, timingSafeEqual } from "crypto";

import type { PartnerAuthenticator } from "@/lib/server/partners/PartnerAuthenticator";
import type {
  AuthenticatedPartner,
  PartnerScope,
} from "@/lib/server/partners/types";

type EnvPartnerConfig = {
  partnerId: string;
  name: string;
  status?: "active" | "disabled";
  apiKey?: string;
  apiKeyHash?: string;
  scopes?: PartnerScope[];
  rateLimit?: {
    limit: number;
    windowSeconds: number;
  };
};

const DEFAULT_SCOPES: PartnerScope[] = [
  "bookings:create",
  "bookings:read",
  "bookings:status:read",
  "webhooks:test",
];

function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

function getApiKey(req: Request) {
  const direct = req.headers.get("x-api-key");
  if (direct) return direct.trim();

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return "";
}

function parsePartnerConfigs(): EnvPartnerConfig[] {
  const raw = process.env.HCAD_PARTNER_CREDENTIALS;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class EnvironmentPartnerAuthenticator implements PartnerAuthenticator {
  async authenticate(req: Request) {
    const apiKey = getApiKey(req);
    if (!apiKey) {
      return { ok: false as const, reason: "missing_api_key" as const };
    }

    const apiKeyHash = hashApiKey(apiKey);
    const partners = parsePartnerConfigs();

    for (const item of partners) {
      const configuredHash = item.apiKeyHash || (item.apiKey ? hashApiKey(item.apiKey) : "");
      if (!configuredHash) continue;

      if (safeEquals(apiKeyHash, configuredHash)) {
        if (item.status === "disabled") {
          return { ok: false as const, reason: "partner_disabled" as const };
        }

        const partner: AuthenticatedPartner = {
          partnerId: item.partnerId,
          name: item.name,
          status: item.status || "active",
          scopes: item.scopes?.length ? item.scopes : DEFAULT_SCOPES,
          rateLimit: item.rateLimit,
        };

        return { ok: true as const, partner };
      }
    }

    return { ok: false as const, reason: "invalid_api_key" as const };
  }
}

export const partnerAuthenticator = new EnvironmentPartnerAuthenticator();
