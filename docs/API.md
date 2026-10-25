# FixMate REST API

Base: `/api`. JSON requests/responses except multipart uploads and authenticated file downloads. Authentication uses the `fixmate_session` HTTP-only cookie. Send credentials with requests. State-changing browser requests must originate from `CLIENT_ORIGIN`. Errors use `{ "error": "human-readable message" }`.

Common responses: `400` validation, `401` missing/expired login, `403` role/ownership denial, `404` missing record, `409` workflow conflict/duplicate, `429` rate limit, `503` unavailable configured integration.

## Authentication

| Method    | Path                        | Access / body                                                     |
| --------- | --------------------------- | ----------------------------------------------------------------- |
| POST      | `/auth/customer/register`   | Public: name, email, phone, password, city, address               |
| POST      | `/auth/technician/register` | Public: same + shopName, categories[], experience; starts pending |
| POST      | `/auth/customer/login`      | email, password                                                   |
| POST      | `/auth/technician/login`    | email, password                                                   |
| POST      | `/auth/admin/login`         | email, password; no public admin registration                     |
| GET       | `/auth/me`                  | Signed in; returns safe user fields                               |
| POST      | `/auth/logout`              | Signed in; revokes all current sessions for this account          |
| POST      | `/auth/forgot-password`     | email; generic response                                           |
| POST      | `/auth/reset-password`      | token, password; single-use recovery                              |
| GET/PATCH | `/profile`                  | Own profile; patch name, phone, city, address                     |

## Appliance catalog and discovery

| Method           | Path                                             | Behavior                                                                                |
| ---------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| GET              | `/categories`                                    | Public, active categories                                                               |
| GET              | `/shops?category=washing-machine&city=Bengaluru` | Public, approved active shops with published services; real review aggregates           |
| GET              | `/shops/:id`                                     | Public approved shop and services                                                       |
| GET              | `/shops/:id/reviews`                             | Public non-hidden reviews                                                               |
| POST             | `/shop-matching`                                 | Signed in: message, optional category, city; returns mode and matches with explanations |
| GET/POST         | `/appliances`                                    | Customer-owned list/create                                                              |
| GET/PATCH/DELETE | `/appliances/:id`                                | Owner only; DELETE archives and retains service history                                 |
| GET              | `/my-shop`                                       | Technician's own shop and service listings                                              |
| POST             | `/shops`                                         | Technician without a shop; name, address, city, categories                              |
| PATCH            | `/shops/:id`                                     | Owning technician: name, address, city; requires re-verification                        |
| POST             | `/services`                                      | Technician: category, title, description, inspectionPrice, published                    |
| PATCH            | `/services/:id`                                  | Owning technician or admin: published                                                   |

Appliance body: `category`, `brand`, `model`, optional `purchaseYear`, `serial`, `image` (owned upload ID), `warranty`. Unsupported/disabled categories are rejected.

## Repair lifecycle

| Method | Path                          | Behavior                                                                                           |
| ------ | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| POST   | `/repairs`                    | Customer: appliance, shop, symptoms, address, city, appointment (ISO date), photos[]               |
| GET    | `/repairs`                    | Own customer repairs or own shop's repairs; no unrestricted admin listing                          |
| GET    | `/repairs/:id`                | Participant or authorized investigator; repair, history, inspection, quotes, review                |
| PATCH  | `/repairs/:id/status`         | Valid role transition; status, note; completion also requires finalWork, replacedParts, finalTotal |
| POST   | `/repairs/:id/inspection`     | Assigned active verified technician: symptoms, findings, diagnosis, parts, estimatedHours          |
| POST   | `/repairs/:id/quotes`         | Technician: items[{label,amount}], validUntil, estimatedCompletion; server calculates total        |
| GET    | `/repairs/:id/quotes`         | Authorized participants/investigator, newest revision first                                        |
| POST   | `/repairs/:id/quote-approval` | Owning customer: quoteId, decision (`approved`, `rejected`, `clarification`), note                 |

Normal stages:

```text
REQUESTED → ACCEPTED → INSPECTION_SCHEDULED → INSPECTED
→ QUOTE_PENDING → QUOTE_SENT → QUOTE_APPROVED
→ REPAIR_IN_PROGRESS → REPAIR_COMPLETED → READY_FOR_COLLECTION → CLOSED
```

Inspection saving performs INSPECTED. Issuing a quote performs QUOTE_SENT (allowed from INSPECTED, QUOTE_PENDING, QUOTE_SENT for revision, or QUOTE_REJECTED). Customer decision performs QUOTE_APPROVED/QUOTE_REJECTED. A revised quote supersedes a pending quote. An approved quote is immutable. Quote totals use integer-paise summation. Final charges cannot exceed the approved total. Concurrent approval attempts resolve to one success and one conflict.

Technicians may DECLINE a REQUESTED booking. Customers may CANCEL before approval and may close READY_FOR_COLLECTION. The assigned technician may also close a ready repair with a note. Invalid transitions, outsider records, and administrator/technician customer-approval bypasses are rejected.

## Files, reviews, notifications

| Method | Path                  | Behavior                                                                                           |
| ------ | --------------------- | -------------------------------------------------------------------------------------------------- |
| POST   | `/uploads`            | Multipart `file`, `purpose` = appliance/repair/verification; 5 MB; image/PDF magic-byte validation |
| POST   | `/shop-documents`     | Alias of uploads; technician verification purpose                                                  |
| GET    | `/uploads/:id`        | Private authenticated download, attachment disposition, no-store                                   |
| POST   | `/reviews`            | Customer: repair, rating 1–5, comment; one per own CLOSED repair                                   |
| POST   | `/reviews/:id/report` | Signed in: reason; one report per account                                                          |
| GET    | `/notifications`      | Own latest 100 notifications                                                                       |
| PATCH  | `/notifications/:id`  | Mark own notification read                                                                         |

## Smart Assist

`POST /repair-chat` and `POST /repair-agent` accept `message`, optional `category`, `sessionId`, `history` (boolean). Customer role required. Response includes `answer`, `question`, `category`, `symptoms`, `sources`, `mode`, `notice`, `disclaimer`, and `sessionId` where applicable. Modes include `rag`, `approved-guidance`, `safety`, `clarification`, `no-sources`, and `private-history`. No diagnosis/pricing is fabricated.

`GET /chat-sessions/:id`: owning customer only. Conversations are limited to 60 stored messages. `history:true` queries only the caller's own recent service history.

## Administrator

All paths below require admin role:

| Method   | Path                                 | Behavior                                                                    |
| -------- | ------------------------------------ | --------------------------------------------------------------------------- |
| GET      | `/admin/overview`                    | Customer/technician/shop/application/repair counts                          |
| GET      | `/admin/analytics`                   | Appliance, month, workload, verification, status aggregates                 |
| GET      | `/admin/pending-shops`               | Pending applications                                                        |
| GET      | `/admin/shops`                       | Shops, applicant details, verification documents, services                  |
| PATCH    | `/admin/shops/:id/verification`      | verification approved/rejected, reason; alias `/shops/:id/verification`     |
| PATCH    | `/admin/shops/:id/active`            | active boolean, reason                                                      |
| GET      | `/admin/customers`                   | Customer directory                                                          |
| GET/POST | `/admin/categories`                  | List all or create household appliance category                             |
| PATCH    | `/admin/categories/:id`              | Edit name/group/description/symptoms or active flag; slug immutable         |
| GET      | `/admin/reviews`                     | Reported reviews                                                            |
| PATCH    | `/admin/reviews/:id`                 | hidden, moderationReason                                                    |
| GET/POST | `/admin/knowledge-documents`         | List or approve title, category, source, content                            |
| POST     | `/admin/knowledge-documents/reindex` | Embed approved references and published services; AI configuration required |
| GET      | `/admin/audit-logs`                  | Latest 200 audit records                                                    |
| GET/POST | `/admin/investigations`              | Own investigations or request with repair, reason                           |
| POST     | `/admin/investigations/:id/close`    | Close own investigation                                                     |

Customer support endpoints: `GET /support-requests`, `POST /support-requests/:id/authorize`. Authorization grants the requesting admin read access to that specific repair for 24 hours. It does not grant mutation or customer-approval rights. Every private read is logged.

`GET /health` reports readiness, demo flag, and whether AI is configured. It does not expose credentials or assert that external AI services are reachable.
