# OfficeFlow AI Architecture and Implementation Plan

## 1. Architecture
OfficeFlow AI is built as a single, unified Next.js full-stack application using the App Router. The frontend and backend reside within the same repository and run on a Node.js runtime. 
- **Frontend**: Next.js (React), Tailwind CSS, TypeScript.
- **Backend**: Next.js Route Handlers (Serverless functions), Node.js.
- **Database**: PostgreSQL accessed via Prisma ORM.
- **AI**: Gemini API for natural language understanding and multi-agent routing.
- **Hosting**: Vercel.

## 2. Folder Structure
```text
.
├── app/                  # Next.js App Router pages and API routes
│   ├── api/              # Backend Route Handlers
│   ├── dashboard/        # Employee dashboard
│   ├── request/          # Request submission page
│   ├── tickets/          # Ticket viewing pages
│   └── admin/            # Admin dashboard
├── components/           # Reusable UI components
├── lib/                  # Core utilities (db, gemini)
├── agents/               # AI Agent implementations (orchestrator, specialized agents)
├── tools/                # Registered tools for agents
├── services/             # Business logic and database access
├── prisma/               # Prisma schema and migrations
└── public/               # Static assets
```

## 3. Prisma Schema Design
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Employee {
  id         Int      @id @default(autoincrement())
  name       String
  email      String   @unique
  department String
  role       String
  devices    Device[]
  tickets    Ticket[]
}

model Device {
  id           Int      @id @default(autoincrement())
  employeeId   Int
  type         String
  model        String
  serialNumber String   @unique
  status       String
  employee     Employee @relation(fields: [employeeId], references: [id])
}

model OfficeAsset {
  id           Int      @id @default(autoincrement())
  name         String
  type         String
  location     String
  status       String
  assignedTeam String
}

model Ticket {
  id               Int      @id @default(autoincrement())
  employeeId       Int
  category         String
  subcategory      String?
  title            String
  description      String
  priority         String
  status           String
  assignedTeam     String
  assignedTo       String?
  requiresApproval Boolean  @default(false)
  approvalStatus   String   @default("NOT_REQUIRED")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  employee         Employee @relation(fields: [employeeId], references: [id])
}

model Policy {
  id       Int    @id @default(autoincrement())
  category String
  title    String
  content  String
}

model AgentLog {
  id        Int      @id @default(autoincrement())
  requestId String
  agent     String
  action    String
  tool      String
  input     Json
  result    Json
  status    String
  timestamp DateTime @default(now())
}
```

## 4. API Routes
- `POST /api/requests` - Submit a natural language request, triggers Orchestrator.
- `GET /api/tickets` - List tickets.
- `GET /api/tickets/[id]` - Get ticket details.
- `GET /api/agent-logs/[requestId]` - Get real-time workflow logs for a request.
- `POST /api/approvals/[id]` - Handle security/IT approvals.

## 5. Agent Architecture
The system uses a hierarchical multi-agent architecture powered by the Gemini API:
1. **Orchestrator Agent**: Analyzes the employee's request, splits it into separate tasks (e.g., IT vs. Facilities), and delegates them to specialized agents.
2. **Specialized Agents** (IT Agent, Facilities Agent, Security & Access Agent): Focus on specific domains. They cannot execute arbitrary code or SQL; they can only call explicitly registered backend tools.

## 6. Tool Architecture
Tools act as the secure bridge between AI Agents and the Database.
- Explicit registry of tools (e.g., `check_device`, `create_ticket`).
- Typed input and output schemas using Zod.
- Tools invoke secure Service functions that query PostgreSQL via Prisma.
- The LLM never touches Prisma or the DB directly.

## 7. Request Lifecycle
1. **Browser**: User submits a request via Next.js UI.
2. **Next.js Route Handler**: Receives the request and invokes the Orchestrator.
3. **Orchestrator Agent**: Processes the request using Gemini, decides which specialized agents to call.
4. **Specialized Agent**: Decides which tools to use to solve the problem.
5. **Tool Registry**: Validates tool invocation and runs the backend Tool function.
6. **Service / Prisma**: Executes the deterministic business logic and database queries.
7. **PostgreSQL**: Returns data.
8. **Tool Result**: The structured result goes back to the Agent.
9. **Orchestrator**: Aggregates all specialized agent results.
10. **Browser**: Receives the consolidated final API response.

## 8. Environment Variables
```env
# Required environment variables
DATABASE_URL="postgresql://user:password@host:port/database"
GEMINI_API_KEY="your_secure_gemini_api_key"
NEON_AUTH_BASE_URL="https://your-neon-auth-url"
NEON_AUTH_COOKIE_SECRET="a-long-random-server-only-secret"

# Optional demo-only admin login; keep values server-side and unset outside demos.
DEMO_IT_ADMIN_PASSWORD=""
DEMO_FACILITIES_ADMIN_PASSWORD=""
DEMO_SECURITY_ADMIN_PASSWORD=""
```

## 9. Vercel Deployment Architecture
- **Framework**: Next.js App Router deployed on Vercel.
- **Compute**: Vercel Serverless Functions (Node.js runtime) for API routes.
- **Database**: External PostgreSQL database (e.g., Vercel Postgres, Supabase, Neon) connected via connection pooling.
- **Security**: Environment variables securely stored in Vercel.

## 10. Team Implementation Plan
We will build incrementally according to the prompt sequence:
1. **Phase 1**: Setup Next.js Foundation and Prisma ORM.
2. **Phase 2**: Define Database schema and seed demo data.
3. **Phase 3**: Implement server-side Gemini integration.
4. **Phase 4**: Build the Tool System with strict validation.
5. **Phase 5**: Develop the Orchestrator Agent and Specialized Agents (IT, Facilities).
6. **Phase 6**: Integrate the frontend UI to visualize real-time agent workflows.
