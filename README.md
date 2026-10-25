# FixMate

**Smart Appliance Repair & Service Intelligence Platform**  
_From Fault to Fix, Smarter Than Ever._

FixMate is a MERN application with separate customer, technician, and administrator workspaces. Booking, inspection, quotations, approval, repair updates, reviews, and administration use the same MongoDB records. The homepage uses procedural Three.js appliances, a skippable GSAP introduction, and a scroll-driven component explorer.

## Start the local demonstration

Requirements: Node.js **22.12+** (tested with 24.14), npm, and internet access for the initial dependency/MongoDB binary download. Windows, macOS, and Linux are supported by the launcher, though this project was verified on Windows.

```sh
npm ci
npm run demo
```

Wait for **“FixMate API ready”**, then open **http://localhost:5173**. Use `localhost`, consistently, for both the browser URL and `CLIENT_ORIGIN`.

The launcher creates a real local MongoDB replica set with a persistent WiredTiger database in `.data/mongo`. Despite the launcher's package name (`mongodb-memory-server`), this demo does **not** use an in-memory application store. Existing records survive restarts. A stable replica configuration is reconciled on startup. This local database is bound to loopback and intended for development only.

Generated demo credentials are in **`.data/demo-accounts.txt`**. The password is generated randomly on first launch, rather than hard-coded in the frontend or repository.

| Role                | Email                     | Portal              |
| ------------------- | ------------------------- | ------------------- |
| Customer            | `customer@fixmate.demo`   | `/customer/login`   |
| Verified technician | `technician@fixmate.demo` | `/technician/login` |
| Pending technician  | `pending@fixmate.demo`    | `/technician/login` |
| Administrator       | `admin@fixmate.demo`      | `/admin/login`      |

All seeded shops, names, appliances, reviews, and history are fictional demonstration data. The app labels them accordingly. New actions persist normally. Seeds are idempotent and never reset existing account passwords. After changing a demo password, use the new password; the initial credentials file is not a password vault.

Stop with **Ctrl+C**. Restart `npm run demo` after backend source changes; frontend edits update automatically. Do not run two demo servers against the same `.data/mongo` directory. Do not delete `.data` if you want to retain records, uploads, and demo credentials.

## Configured MongoDB / Atlas mode

1. Copy `.env.example` to `.env` in the project root.
2. Set `MONGODB_URI` to your Atlas connection string, with a database name such as `fixmate`. Create a dedicated database user and allow the application's host IP in Atlas Network Access.
3. Set `JWT_SECRET` to a cryptographically random string of at least 32 characters. For example: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
4. Set `CLIENT_ORIGIN=http://localhost:5173` for local development.
5. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DEMO_PASSWORD` before running `npm run seed`. Both seed passwords must be 12–72 bytes. The seed creates the initial admin securely; administrator registration is never public.
6. Run `npm run dev`.

Transactions require a replica set. Atlas satisfies this requirement; a standalone `mongod` without a replica set does not. `npm run demo` intentionally uses its own local database and generated secret instead of the configured Atlas database.

For a production build:

```sh
npm run build
npm start
```

The Express server serves `client/dist` and the API from the same origin. Configure `CLIENT_ORIGIN` to the actual browser origin. Use `NODE_ENV=production` behind an HTTPS reverse proxy; session cookies are Secure in production. The server listens on `127.0.0.1:4000` by default, suitable for a local reverse proxy. Keep `.env` and `.data` private, persist the upload directory, and back up both MongoDB and uploads. Do not deploy the demo database launcher as a public database.

This project retains the requested Node/Express/Mongoose architecture. It is not deployed to Sites' Cloudflare Worker runtime, which does not support the raw TCP connection used by Mongoose. Deploy the Node server to a suitable Node host when external credentials and hosting are available.

## Ollama + LangChain + Atlas Vector Search

The application has two explicitly distinguished assistance modes:

- **RAG mode:** Ollama embeddings → Atlas vector search → approved reference chunks → structured Ollama answer with source references.
- **Reference mode:** database-backed approved guidance, with a visible explanation that live AI/vector retrieval is unavailable. This fallback is not presented as an AI-generated diagnosis.

To enable live RAG:

1. Install Ollama from [ollama.com](https://ollama.com/download) and start its service.
2. Pull the models:

   ```sh
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ```

3. Configure an Atlas database and set these server variables:

   ```dotenv
   AI_ENABLED=true
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=llama3.2
   OLLAMA_EMBED_MODEL=nomic-embed-text
   VECTOR_DIMENSIONS=768
   KNOWLEDGE_INDEX=knowledge_vector
   SERVICE_INDEX=services_vector
   ```

4. Run `npm run indexes`. This provisions vector indexes on `knowledgechunks` and `servicelistings`. Wait for Atlas to report both indexes queryable. The configured dimensions must match the embedding model.
5. Start the app in configured database mode (`npm run dev`). Sign in as admin, open **Knowledge base**, and approve category-specific reference documents. The form accepts pasted text or a local `.txt` document.
6. Click **Rebuild knowledge & service embeddings**. This creates document chunks and embeds published service listings through LangChain's Ollama integration.
7. Ask a customer question in **Smart Assist**. Verify the response reports RAG mode with source references. Technician matching uses semantic retrieval when enabled, and otherwise explicitly uses verified appliance/city filters.

Changing the embedding model requires updating dimensions, rebuilding indexes, and re-embedding documents/services. Seed knowledge is clearly marked sample guidance; replace it with properly reviewed manufacturer references for real use.

Safety handling blocks hazard scenarios before model invocation, restricts the model to approved references, validates structured output/source IDs, and rejects several unsafe instruction patterns. These controls do not turn an LLM into a diagnostic authority. Final diagnosis and pricing belong to a qualified technician. The history assistant only queries the authenticated customer's records.

**Live Ollama inference and Atlas vector retrieval need your installed models and Atlas configuration. They were not verified against a live external deployment in this workspace.**

## Working features

- Separate branded role portals, customer/technician registration, password visibility, recovery, and role-protected dashboards.
- HTTP-only JWT cookies, password hashing, session revocation, request-origin checks, validation, rate limits, record ownership, and private uploads.
- All 23 requested household appliance categories, appliance registration/edit/archive, photos, warranty details, and verified service discovery.
- Booking with appliance, symptoms, photos, city/address, shop, and preferred appointment. No invented availability or distance.
- Technician acceptance/decline, inspection reports, quotation line items, INR totals, validity, estimated completion, and revision history.
- Customer approval, rejection, and clarification. Technicians and administrators cannot approve on the customer's behalf.
- Validated repair stages, persisted notes/timestamps, 30-second visible-tab polling, final work/parts/charges, and service history.
- Completed-service reviews, report submission, and administrator moderation.
- Notifications, quotation clarification messages, profiles, shop services, and verification document upload.
- Admin metrics/charts, shop verification/suspension, service publishing, category administration, customer directory, knowledge management, and audit logs.
- Private support investigations require customer authorization, expire after 24 hours, and log each private read.
- Responsive dark green/black/red UI, procedural 3D appliances, orbit interaction, scroll explosion/reassembly, motion preferences, and source-backed assistance.

Appointment preferences require shop confirmation. No payment gateway, real-time distance/availability service, or live support provider is included; those were optional integrations. Notifications use polling/refresh rather than Socket.IO. Technician “Messages” shows customer quotation questions, rather than a separate unrestricted chat system.

## Password recovery

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` for real recovery email delivery. In local demo mode only, the most recent recovery link is written to `.data/password-reset.txt`. Recovery tokens are random, stored hashed, expire after 30 minutes, are single-use, and revoke existing sessions when redeemed. Without SMTP outside demo mode, no recovery email can be delivered.

## Tests and verification

```sh
npm test
npm run build
```

Integration tests create isolated real MongoDB replica sets. They exercise registration/login, authorization, ownership, supported categories, booking, inspection, quotes/revisions, concurrent decisions, customer approval, final-charge limits, completion, reviews, support authorization, AI reference fallback, hazard handling, uploads, shop suspension, analytics, and logout revocation. The persistence test restarts an on-disk database and verifies a saved record survives. Test databases are independent of the demo database.

On a restricted execution environment, localhost connections and MongoDB process launch may need permission. A blocked local socket is an infrastructure failure, not a passing test. The initial MongoDB binary download needs internet access; subsequent runs use the cache. `npm ci` installs the versions locked in `package-lock.json`.

See [docs/DEMO.md](docs/DEMO.md) for the complete customer → technician → customer → technician → admin walkthrough and [docs/API.md](docs/API.md) for the API contract.

## Structure

```text
client/src/
  components/    shared UI, fields, dialogs, data loading
  contexts/      authentication
  features/      customer, technician, admin, repair workflows
  layouts/       protected role workspace
  pages/         homepage, auth, discovery, assistant
  services/      API client and upload helpers
  styles/        theme and responsive styles
  three/         procedural appliances and scroll scene
server/src/
  ai/            LangChain/Ollama retrieval and Atlas indexes
  config/        environment and persistent local MongoDB
  middleware/    sessions, roles, error helpers
  models/        17 domain models plus private upload metadata
  routes/        validated HTTP controllers grouped by domain
  services/      lifecycle rules and transaction management
  validators/    shared Zod schemas
  seeds/         idempotent demo data and admin initialization
  tests/         real-database integration and persistence tests
```

## Before public deployment

Configure Atlas, a persistent upload disk, HTTPS, real SMTP/support contacts, reviewed privacy/terms, and reviewed knowledge sources. Use a non-demo administrator account and remove fictional demonstration data from a live database. This repository provides a working local project and external integration code, not a claim of a deployed or externally verified production service.
