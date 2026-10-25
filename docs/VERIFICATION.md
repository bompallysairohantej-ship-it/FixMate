# Verification record

Verified locally on Windows with Node.js 24.14.1. Final checks: 25 October 2026.

## Automated checks

- `npm run build`: passed; Vite production assets generated successfully.
- `npm test`: **16 passed, 0 failed**, using real MongoDB processes.
- Dependency installation audit: **0 reported vulnerabilities** at installation time (not a permanent security guarantee).
- Tests use separate databases and a distinct persistence-test replica set. Running the final suite left the demo `/api/health` endpoint ready.

The test suite covers verified-only discovery; role-specific login and registration; origin checks; appliance ownership; booking privacy; inspection and quote prerequisites; quotation totals, clarification, rejection and revision history; concurrent approval conflicts; customer-only authorization; final-charge ceilings; service completion and reviews; time-limited support authorization and read auditing; AI reference grounding and hazard handling; private file access; shop suspension; database metrics; session revocation; and real database shutdown/restart persistence.

## Browser checks

- Homepage, procedural 3D appliances, and customer login rendered in the in-app browser.
- Customer login populated the dashboard with the seeded MongoDB records.
- Booking selected the registered washer, retrieved the matching verified shop, and saved a new request.
- Technician login displayed that same new request. Accepting it through the UI updated the saved status and timeline.
- Administrator login and database-backed dashboard checked separately.
- Desktop and narrow viewport layouts were inspected. A narrow-screen button overflow and a washer-door geometry orientation were corrected.

Browser checks are representative manual smoke tests, not exhaustive automated cross-browser or mobile-device certification. Backend workflow tests cover the complete lifecycle, including quote decisions and completion.

## External configuration not verified here

- Live MongoDB Atlas connection and Atlas Vector Search index readiness.
- Live Ollama embedding generation and language-model inference. Ollama is not installed on this host.
- SMTP password-recovery delivery; no provider credentials were supplied.
- Public hosting and production HTTPS configuration.

The integration code and setup instructions are included. Without those external services, Smart Assist displays approved-reference mode and does not claim live RAG inference. No real-time availability, distance, payment processing, or live support inbox is fabricated.
