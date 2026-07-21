import { ApiError } from "@/lib/server/errors/ApiError";
import { getEndpointPath, getOrCreateRequestId } from "@/lib/server/api/request";
import { errorResponse, successResponse } from "@/lib/server/api/responses";
import { partnerAuthenticator } from "@/lib/server/partners/EnvironmentPartnerAuthenticator";
import { partnerHasScope } from "@/lib/server/partners/authorization";
import type { PartnerScope } from "@/lib/server/partners/types";
import { rateLimiter } from "@/lib/server/rateLimit/RateLimiter";
import { createServiceContext, type ServiceContext } from "@/lib/server/services/serviceContext";

export type PartnerRouteResult = {
  data: unknown;
  status?: number;
  resourceId?: string;
};

export type PartnerRouteParams = {
  params?: Record<string, string>;
};

type PartnerRouteOptions = {
  requiredScope: PartnerScope;
  handler: (
    ctx: ServiceContext,
    req: Request,
    route: PartnerRouteParams
  ) => Promise<PartnerRouteResult>;
};

function statusForAuthReason(reason: string) {
  if (reason === "partner_disabled") return 403;
  return 401;
}

function codeForAuthReason(reason: string) {
  if (reason === "partner_disabled") return "FORBIDDEN" as const;
  return "UNAUTHORIZED" as const;
}

async function writeAudit(
  ctx: ServiceContext,
  req: Request,
  args: {
    endpoint: string;
    requiredScope?: string;
    result: "success" | "error";
    responseStatus: number;
    resourceId?: string;
    errorCode?: string;
    startedAt: number;
  }
) {
  try {
    await ctx.auditLogger.log({
      requestId: ctx.requestId,
      partnerId: ctx.partner?.partnerId,
      partnerName: ctx.partner?.name,
      endpoint: args.endpoint,
      method: req.method,
      requiredScope: args.requiredScope,
      result: args.result,
      responseStatus: args.responseStatus,
      resourceId: args.resourceId,
      errorCode: args.errorCode,
      durationMs: Date.now() - args.startedAt,
      environment: ctx.environment,
      timestamp: ctx.requestTimestamp.toISOString(),
    });
  } catch (error) {
    console.error("[partner-api] audit log failed", {
      requestId: ctx.requestId,
      endpoint: args.endpoint,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export function createPartnerApiHandler(options: PartnerRouteOptions) {
  return async function handlePartnerRoute(
    req: Request,
    route: PartnerRouteParams = {}
  ) {
    const startedAt = Date.now();
    const requestId = getOrCreateRequestId(req);
    const endpoint = getEndpointPath(req);
    let ctx = createServiceContext({ requestId });

    const auth = await partnerAuthenticator.authenticate(req);
    if (!auth.ok) {
      const status = statusForAuthReason(auth.reason);
      await writeAudit(ctx, req, {
        endpoint,
        requiredScope: options.requiredScope,
        result: "error",
        responseStatus: status,
        errorCode: codeForAuthReason(auth.reason),
        startedAt,
      });

      return errorResponse(requestId, status, {
        code: codeForAuthReason(auth.reason),
        message: "Authentication failed.",
      });
    }

    ctx = createServiceContext({
      requestId,
      partner: auth.partner,
      actorId: auth.partner.partnerId,
    });

    if (!partnerHasScope(auth.partner, options.requiredScope)) {
      await writeAudit(ctx, req, {
        endpoint,
        requiredScope: options.requiredScope,
        result: "error",
        responseStatus: 403,
        errorCode: "FORBIDDEN",
        startedAt,
      });

      return errorResponse(requestId, 403, {
        code: "FORBIDDEN",
        message: "The partner is not allowed to access this resource.",
      });
    }

    const rateLimit = await rateLimiter.check(auth.partner, req);
    if (!rateLimit.ok) {
      await writeAudit(ctx, req, {
        endpoint,
        requiredScope: options.requiredScope,
        result: "error",
        responseStatus: 429,
        errorCode: "RATE_LIMITED",
        startedAt,
      });

      return errorResponse(requestId, 429, {
        code: "RATE_LIMITED",
        message: "Too many requests.",
      });
    }

    try {
      const result = await options.handler(ctx, req, route);
      const status = result.status || 200;

      await writeAudit(ctx, req, {
        endpoint,
        requiredScope: options.requiredScope,
        result: "success",
        responseStatus: status,
        resourceId: result.resourceId,
        startedAt,
      });

      return successResponse(requestId, result.data, status);
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(
              500,
              "INTERNAL_ERROR",
              "The request could not be processed."
            );

      await writeAudit(ctx, req, {
        endpoint,
        requiredScope: options.requiredScope,
        result: "error",
        responseStatus: apiError.status,
        errorCode: apiError.code,
        startedAt,
      });

      return errorResponse(requestId, apiError.status, {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      });
    }
  };
}
