# OfficeFlow AI

> An AI-powered internal office helpdesk that intelligently routes employee requests to specialized AI agents, creates and manages tickets, and uses human approval for high-risk security actions.

## 📌 Overview

**OfficeFlow AI** is a full-stack AI-powered internal office helpdesk designed to make workplace issue reporting and resolution more intelligent, secure, and organized.

Employees can submit requests in natural language, such as:

> "The projector and AC in Conference Room B aren't working and we have a client meeting tomorrow."

OfficeFlow AI analyzes the request, identifies the required operational teams, and routes the work to specialized AI agents.

```text
Employee Request
       ↓
   AI Orchestrator
       ↓
 ┌─────┴─────────┐
 ↓               ↓
IT Agent    Facilities Agent
 ↓               ↓
IT Ticket   Facilities Ticket
```

For sensitive security requests, the system introduces **Human-in-the-Loop approval** before any high-risk action can proceed.

---

## ✨ Key Features

### 🤖 AI-Powered Request Routing

The system uses an AI orchestrator to understand employee requests and determine which operational teams are required.

Supported AI domains:

* IT
* Facilities
* Security

A single request can be routed to multiple agents when necessary.

### 🖥️ IT Agent

Handles technology-related workplace issues such as:

* Computer problems
* Mouse and keyboard issues
* Projectors
* Devices
* Software-related problems
* IT equipment

The IT Agent can inspect relevant data and create and manage IT tickets.

### 🏢 Facilities Agent

Handles workplace infrastructure and facility-related issues such as:

* Air conditioning
* Conference rooms
* Office equipment
* Facility maintenance
* Workspace issues

### 🔐 Security Agent

Handles security-sensitive requests such as:

* Lost devices
* Security incidents
* Suspicious activity
* Sensitive access-related requests

High-risk security actions require **human approval** before proceeding.

```text
Security Request
      ↓
Security Agent
      ↓
Risk Assessment
      ↓
High Risk?
   ↓       ↓
  Yes      No
   ↓        ↓
Approval   Normal Flow
 Queue
   ↓
Security Admin
   ↓
Approve / Reject
```

The Security Agent does **not** automatically perform sensitive actions without approval.

---

## 👥 Human-in-the-Loop Approval

OfficeFlow AI includes a human approval workflow for high-risk security requests.

Security requests requiring approval are placed into:

```text
PENDING
AWAITING_APPROVAL
```

A Security Admin can then:

* Review the request
* Review the AI recommendation
* Approve the request
* Reject the request

Approval authorization is enforced server-side.

### Security Rules

* Security Admins can approve/reject security approval tickets.
* IT Admins cannot approve Security tickets.
* Facilities Admins cannot approve Security tickets.
* Employees cannot approve tickets.
* Already processed approvals cannot be approved/rejected again.
* Non-approval tickets cannot be approved.

---

## 🎫 Ticket Management

OfficeFlow AI automatically creates tickets from employee requests.

Tickets contain information such as:

* Ticket ID
* Title
* Description
* Category
* Priority
* Status
* Assigned Team
* Assigned Staff
* Approval Status
* Created Date
* Updated Date

Supported operational teams:

```text
IT
FACILITIES
SECURITY
```

---

## 👤 Employee Portal

Employees can:

* Register their account
* Log in
* Submit requests
* View their tickets
* Track ticket status
* View request history
* View their profile information

Employees can only access their own tickets and requests.

---

## 🛠️ Admin Console

OfficeFlow AI provides a separate Admin Console for operational teams.

Admins can:

* View team-specific tickets
* Track ticket statuses
* Manage incoming work
* Update ticket status
* Review security approvals
* Approve/reject high-risk security requests
* Export authorized tickets as CSV

### Team-Based Admin Access

| Admin            | Access             |
| ---------------- | ------------------ |
| IT Admin         | IT tickets         |
| Facilities Admin | Facilities tickets |
| Security Admin   | Security tickets   |

Admins cannot access or manage tickets belonging to other operational teams.

---

## 📊 CSV Export

Admins can export their authorized tickets as a CSV file.

The export contains:

* Ticket ID
* Title
* Category
* Priority
* Status
* Employee
* Assigned Team
* Assigned To
* Approval Status
* Created At
* Updated At

CSV export follows the same server-side authorization rules as the Admin Console.

---

## 🔐 Authentication & Authorization

OfficeFlow AI uses authentication combined with server-side application roles.

### Application Roles

```text
EMPLOYEE
ADMIN
```

Employee identity is derived server-side from the authenticated session.

Client-provided employee IDs, roles, or permissions are not trusted.

### Admin Authorization

Admins are assigned to an operational team:

```text
IT
FACILITIES
SECURITY
```

This ensures admins only manage tickets belonging to their authorized team.

---

## 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │      Employee       │
                    │    Web Interface    │
                    └──────────┬──────────┘
                               │
                               ↓
                    ┌─────────────────────┐
                    │     Next.js App     │
                    │    App Router/UI    │
                    └──────────┬──────────┘
                               │
                               ↓
                    ┌─────────────────────┐
                    │    API Route        │
                    │    Handlers         │
                    └──────────┬──────────┘
                               │
                               ↓
                    ┌─────────────────────┐
                    │   AI Orchestrator   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ↓                ↓                ↓
        ┌──────────┐     ┌────────────┐   ┌────────────┐
        │ IT Agent │     │ Facilities │   │  Security  │
        │          │     │   Agent    │   │   Agent    │
        └────┬─────┘     └─────┬──────┘   └─────┬──────┘
             │                 │                 │
             └─────────────────┼─────────────────┘
                               ↓
                    ┌─────────────────────┐
                    │   Backend Tools     │
                    │   & Prisma ORM      │
                    └──────────┬──────────┘
                               │
                               ↓
                    ┌─────────────────────┐
                    │   PostgreSQL/Neon   │
                    └─────────────────────┘
```

For high-risk Security requests:

```text
Security Agent
      ↓
Risk Assessment
      ↓
Approval Required
      ↓
Security Admin
      ↓
Approve / Reject
      ↓
Ticket State Update
```

---

## 🧠 AI Agent Architecture

OfficeFlow AI does not allow agents to freely modify the database.

Instead, agents interact with registered backend tools.

```text
AI Agent
   ↓
Tool Selection
   ↓
Registered Backend Tool
   ↓
Service Layer
   ↓
Prisma
   ↓
PostgreSQL
```

This keeps database operations controlled, testable, and permission-aware.

---

## 🗄️ Database

The application uses **PostgreSQL** with **Prisma ORM**.

Core entities include:

* Employee
* Device
* OfficeAsset
* Ticket
* Policy
* AgentLog

Tickets store operational information including:

* Category
* Priority
* Status
* Assigned team
* Approval requirements
* Approval status
* Timestamps

---

## 🛠️ Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Next.js Route Handlers
* Node.js
* Prisma ORM

### Database

* PostgreSQL
* Neon

### Authentication

* Neon Auth / Better Auth
* HTTP-only session handling
* Server-side authorization

### AI

* Google Gemini
* `@google/genai`

### Deployment

* Vercel
* Neon PostgreSQL

### Testing

* Jest
* TypeScript
* ESLint

---

## 📁 Project Structure

```text
OfficeFlowAI/
│
├── app/
│   ├── admin/
│   ├── dashboard/
│   ├── profile/
│   ├── request/
│   ├── tickets/
│   │
│   └── api/
│       ├── auth/
│       ├── requests/
│       ├── tickets/
│       ├── approvals/
│       └── agent-logs/
│
├── agents/
│   ├── it-agent.ts
│   ├── facilities-agent.ts
│   ├── security-agent.ts
│   └── ...
│
├── components/
│   ├── AppShell.tsx
│   ├── ApprovalQueue.tsx
│   ├── AgentWorkflow.tsx
│   ├── DashboardStats.tsx
│   ├── RequestForm.tsx
│   ├── TicketCard.tsx
│   └── TicketTable.tsx
│
├── lib/
│   ├── auth/
│   ├── prisma/
│   └── ...
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── tests/
│
├── proxy.ts
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd OfficeFlowAI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file:

```env
DATABASE_URL="your-neon-database-url"

GEMINI_API_KEY="your-gemini-api-key"

DEMO_IT_ADMIN_PASSWORD="your-password"
DEMO_FACILITIES_ADMIN_PASSWORD="your-password"
DEMO_SECURITY_ADMIN_PASSWORD="your-password"
```

Add any additional environment variables required by your Neon Auth configuration.

> Never commit `.env` or expose API keys and passwords in the repository.

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Run database migrations

```bash
npx prisma migrate dev
```

If using the existing production database, follow the project's database deployment workflow instead of running development migrations against production.

### 6. Seed the database

```bash
npx prisma db seed
```

### 7. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🧪 Testing

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Run ESLint:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Run the production build:

```bash
npm run build
```

---

## 🔒 Security Principles

OfficeFlow AI follows several important security principles:

* Server-side authentication
* Server-side authorization
* Role-based access control
* Team-based admin authorization
* Employee ticket ownership enforcement
* Protected approval endpoints
* Atomic approval state transitions
* No client-controlled employee identity
* No client-controlled admin role
* No automatic high-risk security actions
* Controlled AI-to-database tool access
* Environment variables for secrets

---

## 🎨 UI Design

OfficeFlow AI uses a modern SaaS-style interface.

### Brand Palette

```text
Blue       #2563EB
Purple     #7C3AED
Red/Pink   #E11D48
Background #F8FAFC
```

Blue and purple are the primary brand colors, while red/pink are used as supporting accents and highlights.

---

## 💡 Example Workflows

### Example 1 — IT Request

Employee submits:

> "My mouse is not working."

```text
Employee
   ↓
AI Orchestrator
   ↓
IT Agent
   ↓
IT Tools
   ↓
Create IT Ticket
   ↓
IT Admin
```

### Example 2 — Multiple Teams

Employee submits:

> "The projector and AC in Conference Room B aren't working and we have a client meeting tomorrow."

```text
                    Employee Request
                           ↓
                      Orchestrator
                       ↙         ↘
                IT Agent      Facilities Agent
                    ↓                ↓
             IT Ticket        Facilities Ticket
```

The system can split one natural-language request into multiple operational tasks.

### Example 3 — Security Approval

Employee submits:

> "I lost my company laptop."

```text
Employee
   ↓
Orchestrator
   ↓
Security Agent
   ↓
High Risk Detection
   ↓
Approval Required
   ↓
Security Admin
   ↓
Approve / Reject
```

The system does not automatically perform sensitive actions without human authorization.

---

## 🎯 Project Goals

OfficeFlow AI aims to:

* Reduce manual workplace issue routing
* Make internal helpdesk interactions more natural
* Automate repetitive operational workflows
* Keep AI actions controlled through backend tools
* Improve ticket visibility and tracking
* Introduce human oversight for sensitive operations
* Provide team-specific operational dashboards
* Maintain secure server-side authorization

---

## 📌 Project Status

**Completed — Hackathon Ready 🚀**

### Implemented

* [x] Next.js foundation
* [x] PostgreSQL + Prisma
* [x] Authentication
* [x] Employee registration
* [x] Role-based authorization
* [x] Employee dashboard
* [x] Admin Console
* [x] Team-based admin access
* [x] AI Orchestrator
* [x] IT Agent
* [x] Facilities Agent
* [x] Security Agent
* [x] Multi-agent workflow
* [x] Ticket creation and management
* [x] Human approval workflow
* [x] Security approval queue
* [x] Team-specific authorization
* [x] CSV export
* [x] Agent workflow UI
* [x] Server-side security checks
* [x] Automated tests
* [x] Production build validation

---

## 📜 License

This project was developed as a Software Engineering / Hackathon project.
