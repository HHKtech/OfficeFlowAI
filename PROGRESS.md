# OfficeFlow AI — Development Progress

## 1. Project Overview
OfficeFlow AI is an AI-powered internal helpdesk system featuring specialized AI agents (IT, Facilities, Security) managed by an Orchestrator agent. It relies on a Next.js App Router backend, Neon PostgreSQL with Prisma, Neon Auth (Managed Better Auth) for identity management, and the Google Gemini API for agent logic.

## 2. Current Stack
- **Framework:** Next.js 16.3.8 (App Router)
- **Language:** TypeScript (^5)
- **Runtime:** Node.js
- **Database:** PostgreSQL (hosted on Neon)
- **ORM:** Prisma (^5.10.0)
- **AI Integration:** `@google/genai` (^2.27.0) (Gemini)
- **Authentication:** Neon Auth (`@neondatabase/auth` ^0.5.0-beta)
- **Package Manager:** npm
- **Testing:** Jest & ts-jest
- **Styling:** Tailwind CSS (^4)

## 3. Completed Prompts

| Prompt | Status | What was implemented |
|---|---|---|
| Prompt 0 (Setup) | Complete | Initialized Next.js, TypeScript, Tailwind, ESLint. Configured DB environment vars. |
| Prompt 1 (DB & Prisma) | Complete | Defined Prisma schema (Employee, Device, OfficeAsset, Ticket, Policy, AgentLog), created DB migration, seeded data. |
| Prompt 2 (Gemini Integration) | Complete | Created `lib/gemini.ts` for server-side GenAI integration (`generateWithTools`, structured output, `runAgentLoop`). |
| Prompt 3 (Architecture & API) | Complete | Set up `services/` layer (DB access) and base API routes (`/api/requests`, `/api/tickets`, etc.). Stubbed `agents/` layer. |
| Prompt 4 (Tool Registry) | Complete | Created `tools/registry.ts` and individual tool files that safely interface with services. Tested registry security. |
| Neon Auth Backend | Complete | Integrated Managed Better Auth, created session helpers, mapped users to `Employee` via `authUserId`, secured API routes, established `AppRole`. |

## 4. Current Architecture
```text
Browser
  ↓
Next.js API Routes (Protected via lib/auth/session.ts & Neon Auth sessions)
  ↓
Agent/Tool Layer (agents/ stubbed, tools/registry.ts fully implemented)
  ↓
Services Layer (services/ encapsulating business & Prisma logic)
  ↓
Prisma ORM
  ↓
Neon PostgreSQL (App data & neon_auth schema for Managed Better Auth)
```
Neon Auth provides the identity and sessions. The app proxies auth requests via `/api/auth/[...path]`. The backend verifies the session JWT, retrieves the `authUserId`, and maps it to the internal `Employee` model. Agents interact with the environment exclusively via the Tool Registry.

## 5. Current Folder Structure
- `app/api/` - Next.js Route handlers (requests, tickets, approvals, agent-logs, auth proxy, auth /me).
- `lib/`
  - `gemini.ts` - Google GenAI client and wrappers.
  - `db.ts` - Prisma client singleton.
  - `auth/` - Authentication logic (`server.ts`, `client.ts`, `session.ts`, `__tests__`).
- `prisma/` - Schema, seed script, migrations.
- `services/` - Database operations (employee, ticket, asset, policy services).
- `tools/` - AI Agent tools and `registry.ts`.
- `agents/` - Stub files for orchestrator and specialized agents.
- `proxy.ts` - Next.js middleware for auth session cookies.
- `jest.config.ts` - Jest testing setup.

## 6. Database
**Prisma Schema Models:**
- **Employee:** Application identity. Fields: `id`, `email`, `authUserId` (links to Neon Auth), `appRole` (EMPLOYEE or ADMIN), `department`. Relates to Devices and Tickets.
- **Device:** Represents hardware. Fields: `type`, `serialNumber`, `status`. Relates to Employee.
- **OfficeAsset:** Physical office infrastructure (projectors, AC). Fields: `name`, `location`, `status`, `assignedTeam`.
- **Ticket:** Helpdesk ticket. Fields: `category`, `title`, `priority`, `status`, `approvalStatus`. Relates to Employee.
- **Policy:** Company guidelines for agents to search.
- **AgentLog:** Audit log for AI actions.

**Database State:**
- Migrations `20261004110344_init` and `20261004120000_add_auth_user_id` exist and are applied.
- Seed data has been populated successfully in the active database.

## 7. Authentication
- **Integration:** Neon Auth (Managed Better Auth) integrated via `@neondatabase/auth`.
- **Helpers:** `getCurrentSession`, `requireAuthenticatedUser`, `requireEmployee`, `requireAdmin` (in `lib/auth/session.ts`).
- **Identity Mapping:** Uses `authUserId` in the `Employee` model to safely link a Neon Auth session to the domain user. Client-supplied `employeeId`s in request bodies are aggressively ignored to prevent impersonation.
- **Roles:** Defined via the `AppRole` enum (`EMPLOYEE`, `ADMIN`) on the `Employee` table. Admin checks look at this DB record, not a token claim.
- **Protected Routes:** `/api/tickets`, `/api/tickets/[id]`, `/api/approvals/[id]`, `/api/requests`, `/api/agent-logs/[requestId]`. Employees can only view their own tickets; admins see all and can approve requests.

## 8. Environment Variables
- `DATABASE_URL`: Server-only. Prisma pooled connection string.
- `DATABASE_URL_UNPOOLED`: Server-only. Prisma direct connection string for migrations.
- `NEON_BRANCH`: Server-only. Current Neon branch.
- `NEON_AUTH_BASE_URL`: Server-only. The Managed Auth instance URL.
- `NEON_AUTH_JWKS_URL`: Server-only. Endpoint for token verification.
- `NEON_AUTH_COOKIE_SECRET`: Server-only. 32-byte secret for session cookies. NEVER EXPOSE to client.
- `GEMINI_API_KEY`: Server-only. Token for AI generations.

## 9. Tools
All registered in `tools/registry.ts`:
- `check_device`: Checks device status. (DB: Yes, via `checkDevice` service)
- `check_asset`: Checks office asset info. (DB: Yes, via `checkAsset` service)
- `check_employee_access`: Checks employee security access. (DB: Yes, via service)
- `search_policy`: Searches company policies. (DB: Yes, via service)
- `get_employee`: Retrieves user by ID/email. (DB: Yes, via service)
- `get_previous_tickets`: Fetch ticket history for context. (DB: Yes, via service)
- `create_ticket`: Submits a ticket. (DB: Yes, via service)
- `assign_ticket`: Assigns ticket to an agent. (DB: Yes, via service)
- `update_ticket`: Modifies status/approval. (DB: Yes, via service)
- `log_agent_action`: Logs AI steps for audit. (DB: Yes, via service)

## 10. Gemini Integration
- **Client Setup:** Configured in `lib/gemini.ts` using the official `@google/genai` SDK.
- **Model:** Currently defaults to `gemini-2.0-flash`.
- **Usage:** Provides `generateWithTools`, `generateStructured`, and a recursive `runAgentLoop` for multi-turn tool calling.
- **Status:** Integrated and ready. (Not yet wired to the `/api/requests` endpoint in production).

## 11. Testing Status
| Area | Status | Evidence / Notes |
|---|---|---|
| TypeScript | PASS | `npm run build` succeeds cleanly. |
| ESLint | PASS | `npx eslint .` runs without errors. |
| Prisma validation | PASS | Schema is valid, generated, and pushed. |
| Prisma migration | PASS | Manually verified and deployed safely. |
| Database connection | PASS | Validated via migrations and seed execution. |
| Seed data | PASS | Existing employees/assets exist in the DB. |
| Gemini | NOT TESTED | Core wrapper exists but lacks automated unit tests. |
| Tools | PASS | `tools/__tests__/registry.test.ts` passes. |
| Authentication | PASS | `lib/auth/__tests__/session.test.ts` passes. |
| Production build | PASS | `npm run build` finished successfully. |

## 12. Known Issues
- The Git repository has not been initialized (`git status` fails).
- The Gemini wrapper currently lacks automated mocking/unit tests.
- UI elements (Frontend) are deliberately omitted at this stage.

## 13. Not Yet Implemented
- The actual prompting and logic for the specialized agents (IT, Facilities, Security).
- The Orchestrator agent workflow and logic.
- Connecting `/api/requests` to trigger the actual Orchestrator loop.
- The frontend UI (Login, Dashboards, Request forms).
- Agent workflow visualization.

## 14. Next Step
**NEXT DEVELOPER SHOULD START FROM:** Prompt 5 — Orchestrator Agent

**Why:** The foundational backend architecture (DB, Services, Tools, API Routes) and security boundaries (Neon Auth, Session helpers) are 100% complete and tested. The application is now perfectly positioned to implement the AI Orchestrator that will ingest authenticated requests.

## 15. Developer Handoff Notes
- **DO NOT** rebuild Prompts 0-4 or the authentication backend.
- **DO NOT** replace Prisma, Neon PostgreSQL, or Neon Auth.
- **DO NOT** create a second authentication system (e.g. Clerk, Auth.js) or add OAuth providers. Managed Auth is correctly configured.
- **DO NOT** allow agents to access the database directly; they must strictly use the `tools/registry.ts`.
- **DO NOT** trust client-provided `employeeId` fields. Always use `requireEmployee()` from `lib/auth/session.ts` to get the trusted identity context for the agent.
- **CONTINUE** by implementing the Orchestrator Agent in `agents/orchestrator.ts` and connecting it to the POST handler in `app/api/requests/route.ts`.

## 16. Git / Handoff State
- **Current Branch:** N/A (Git not initialized)
- **Latest Commit:** N/A
- **Uncommitted Changes:** All project files currently exist untracked on disk.

## 17. Verification Checklist
- [x] Prompts 0–4 verified
- [x] Neon Auth backend verified
- [x] Prisma schema verified
- [x] Database connection verified
- [x] Gemini verified (Integration file exists, untested dynamically)
- [x] Tools verified
- [x] Typecheck passes
- [x] Build passes
- [x] PROGRESS.md reviewed
- [x] Ready for teammate handoff
