# HCAD Partner API v1

Release 0 introduces the first versioned Partner API foundation.

## Base Path

```text
/api/v1
```

## Standard Responses

Success:

```json
{
  "ok": true,
  "requestId": "request-id",
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "requestId": "request-id",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be processed.",
    "details": []
  }
}
```

Internal stack traces, Firebase errors, credentials, collection names, and environment values are not returned.

## Authentication

Release 0 uses `EnvironmentPartnerAuthenticator`.

Accepted headers:

```text
Authorization: Bearer <api-key>
```

or

```text
x-api-key: <api-key>
```

The route layer depends on a replaceable `PartnerAuthenticator` interface. Future implementation should use a Firestore-backed `partners` collection with hashed API keys.

## Authorization Scopes

Authentication and authorization are separate.

Endpoints require scopes:

| Endpoint | Scope |
| --- | --- |
| `POST /api/v1/bookings` | `bookings:create` |
| `GET /api/v1/bookings/{id}` | `bookings:read` |
| `GET /api/v1/bookings/{id}/status` | `bookings:status:read` |
| `POST /api/v1/webhooks/test` | `webhooks:test` |

## Endpoints

### GET /api/v1/health

Public health check. Does not expose Firebase details, collection names, credentials, or internal configuration.

Sample response:

```json
{
  "ok": true,
  "requestId": "8fd7...",
  "data": {
    "service": "hcad-partner-api",
    "version": "v1",
    "environment": "sandbox",
    "status": "ok"
  }
}
```

### POST /api/v1/bookings

Creates a pending partner booking. It does not create an operational HCAD case.

Required headers:

```text
Authorization: Bearer sandbox_test_key
Idempotency-Key: partner-unique-request-key
Content-Type: application/json
```

Allowed body fields only:

```json
{
  "externalReference": "AMIGO-10001",
  "patient": {
    "name": "Test Patient",
    "phone": "+966500000000",
    "age": 35,
    "gender": "male"
  },
  "service": {
    "type": "Ambulance Transportation",
    "requestedAt": "2026-07-20T12:00:00+03:00",
    "notes": "Sandbox test booking"
  },
  "pickup": {
    "text": "Sandbox pickup location",
    "lat": 24.7136,
    "lng": 46.6753
  },
  "destination": {
    "text": "Sandbox destination"
  }
}
```

Sample response:

```json
{
  "ok": true,
  "requestId": "8fd7...",
  "data": {
    "booking": {
      "id": "generated-id",
      "externalReference": "AMIGO-10001",
      "status": "pending_review"
    },
    "idempotentReplay": false
  }
}
```

Repeated request with the same partner and idempotency key returns the original booking with `idempotentReplay: true`.

If the same idempotency key is reused with a different payload, the API returns `409 CONFLICT`.

### GET /api/v1/bookings/{id}

Returns a booking owned by the authenticated partner.

### GET /api/v1/bookings/{id}/status

Returns only status-safe fields:

```json
{
  "booking": {
    "id": "generated-id",
    "externalReference": "AMIGO-10001",
    "status": "pending_review"
  }
}
```

### POST /api/v1/webhooks/test

Simulated endpoint only. It does not send requests to production systems or real users.

Optional body:

```json
{
  "destinationUrl": "https://sandbox.partner.example/webhook-test"
}
```

If `HCAD_SANDBOX_WEBHOOK_ALLOWED_HOSTS` is set, the hostname must be in that allow-list.

## Audit Logging

Collection:

```text
partnerApiAuditLogs
```

Captured fields:

- requestId
- partnerId
- partnerName
- endpoint
- method
- requiredScope
- result
- responseStatus
- resourceId
- errorCode
- durationMs
- environment
- timestamp

Audit logs do not store API keys, Authorization headers, Firebase credentials, full patient payloads, secrets, or sensitive medical information.

Audit failures are logged server-side and do not block business operations in Release 0.

## Proposed Collections

### partnerBookings

- partnerId
- externalReference
- idempotencyKey
- status
- patient
- service
- pickup
- destination
- source
- createdVia
- createdAt
- updatedAt

### partnerBookingIdempotency

- partnerId
- idempotencyKeyHash
- requestHash
- bookingId
- createdAt
- updatedAt

Retention recommendation: keep idempotency records for at least 30-90 days, depending on partner retry behavior.

### partnerApiAuditLogs

See audit logging section.

### future partners

Recommended future collection:

```text
partners
```

Suggested fields:

- partnerId
- name
- apiKeyHash
- status
- scopes
- rateLimits
- createdBy
- createdAt
- lastUsedAt
- audit metadata

## Rate Limiting

Release 0 includes a replaceable `RateLimiter` interface and a `NoopRateLimiter`.

No in-memory production rate limiting is implemented because it would be misleading on serverless deployments.
