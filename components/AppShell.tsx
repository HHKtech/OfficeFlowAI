"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { DashboardStats } from "./DashboardStats";
import { RequestForm } from "./RequestForm";
import { label, statusStyles, Ticket, TicketCard } from "./TicketCard";
import { TicketTable } from "./TicketTable";
import { ApprovalQueue } from "./ApprovalQueue";

type Employee = {
  id: number;
  name: string;
  email: string;
  department: string;
  role: string;
  appRole: "EMPLOYEE" | "ADMIN";
  operationalTeam: "IT" | "FACILITIES" | "SECURITY" | null;
};

function useOfficeFlow() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTickets() {
    const response = await fetch("/api/tickets", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load tickets.");
    const data = await response.json();
    setTickets(data.tickets);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const [meResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          loadTickets(),
        ]);
        if (!meResponse.ok) {
          throw new Error(
            meResponse.status === 401
              ? "Please sign in to continue."
              : "No employee profile is linked to this account.",
          );
        }
        const me = await meResponse.json();
        setEmployee(me.employee);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load OfficeFlow.");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  return { employee, tickets, loading, error, refresh: loadTickets };
}

function AccountMenu({ employee }: { employee: Employee | null | undefined }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const initials = employee?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "OF";

  async function signOut() {
    setSigningOut(true);
    try {
      await Promise.all([
        authClient.signOut(),
        fetch("/api/auth/demo/logout", { method: "POST" }),
      ]);
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="relative z-50 shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="flex max-w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-100"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-black text-blue-700 ring-1 ring-blue-100" aria-hidden="true">{initials}</span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-32 truncate text-sm font-bold text-slate-900">{employee?.name || "Account"}</span>
          <span className="block text-[10px] font-black tracking-[.14em] text-slate-400">{employee?.appRole || "ACCOUNT"}</span>
        </span>
        <span className="text-xs text-slate-400" aria-hidden="true">v</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(30,41,59,.16)]" role="menu">
          <div className="border-b border-slate-100 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-bold text-slate-900">{employee?.name}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{employee?.role} · {employee?.department}</p>
          </div>
          <Link href="/profile" onClick={() => setOpen(false)} className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700" role="menuitem">Profile</Link>
          <Link href={employee?.appRole === "ADMIN" ? "/admin" : "/dashboard"} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700" role="menuitem">Dashboard</Link>
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-1 block w-full rounded-xl border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60" role="menuitem">{signingOut ? "Signing out..." : "Sign out"}</button>
        </div>
      )}
    </div>
  );
}

function Shell({ children, employee }: { children: React.ReactNode; employee?: Employee | null }) {
  return (
    <div className="mesh-bg min-h-screen">
      <header className="relative z-30 overflow-visible border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 overflow-visible px-5 py-3 lg:flex-nowrap lg:px-8 lg:py-4">
          <Link href="/dashboard" className="mr-auto flex min-w-0 items-center gap-2.5">
            <span className="brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-md shadow-blue-200">O</span>
            <span className="truncate text-lg font-black tracking-tight text-slate-900">OfficeFlow <span className="brand-text">AI</span></span>
          </Link>
          <nav className="order-3 flex w-full items-center justify-center gap-1 border-t border-slate-100 pt-2 text-sm font-semibold text-slate-500 lg:order-none lg:w-auto lg:border-0 lg:pt-0" aria-label="Primary navigation">
            {/* <Link className="rounded-lg px-2.5 py-2 hover:bg-slate-100 hover:text-slate-900 sm:px-3" href={employee?.appRole === "ADMIN" ? "/admin" : "/dashboard"}>{employee?.appRole === "ADMIN" ? "Console" : "Overview"}</Link> */}
            {employee?.appRole !== "ADMIN" && (
  <Link
    className="rounded-lg px-2.5 py-2 hover:bg-slate-100 hover:text-slate-900 sm:px-3"
    href="/dashboard"
  >
    Overview
  </Link>
)}
            <Link className="rounded-lg px-2.5 py-2 hover:bg-slate-100 hover:text-slate-900 sm:px-3" href={employee?.appRole === "ADMIN" ? "/admin/tickets" : "/tickets"}>Tickets</Link>
            {/* {employee?.appRole !== "ADMIN" && <Link className="brand-gradient rounded-lg px-3 py-2 text-white shadow-sm shadow-blue-200 transition hover:-translate-y-0.5 sm:px-3.5" href="/request">+ New request</Link>} */}
            {employee?.appRole !== "ADMIN" && (
  <Link
    className="relative z-10 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 !text-white shadow-sm shadow-purple-200 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-purple-700 sm:px-3.5"
    href="/request"
  >
    <span className="!text-white">+ New request</span>
  </Link>
)}
            {/* {employee?.appRole === "ADMIN" && <Link className="ml-1 rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-blue-700" href="/admin">Admin</Link>} */}
          </nav>
          <AccountMenu employee={employee} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}

function PageState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500"><span className="mr-3 size-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />Loading your workspace...</div>;
  if (error) return <div className="mx-auto mt-16 max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800"><p className="font-bold">Unable to open OfficeFlow</p><p className="mt-2 text-sm">{error}</p></div>;
  return null;
}

export function Dashboard() {
  const { employee, tickets, loading, error, refresh } = useOfficeFlow();
  const router = useRouter();
  useEffect(() => {
    if (!loading && employee?.appRole === "ADMIN") router.replace("/admin");
  }, [employee, loading, router]);
  if (loading || error) return <Shell employee={employee}><PageState loading={loading} error={error} /></Shell>;
  if (employee?.appRole === "ADMIN") return <Shell employee={employee}><PageState loading error="" /></Shell>;
  const firstName = employee?.name.split(" ")[0] || "there";

  return <Shell employee={employee}><div className="fade-up">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="text-sm font-bold text-blue-600">Hi, {firstName}! 👋</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Your dashboard</h1><p className="mt-2 text-slate-600">{employee?.role} · {employee?.department} · <span className="font-bold text-slate-900">{employee?.appRole}</span></p></div>
      <Link href="/request" className="brand-gradient rounded-xl px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-blue-200">+ New request</Link>
    </div>
    <section aria-labelledby="dashboard-stats-heading"><div className="mb-3 flex items-center justify-between"><h2 id="dashboard-stats-heading" className="text-sm font-bold uppercase tracking-[.16em] text-slate-400">Overview</h2><span className="text-xs font-semibold text-slate-400">Live workspace activity</span></div><DashboardStats tickets={tickets} /></section>
    <div className="mt-8 grid gap-7 lg:grid-cols-[1.08fr_.92fr]">
      <RequestForm onSubmitted={refresh} />
      <section aria-labelledby="recent-requests-heading"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Your workspace</p><h2 id="recent-requests-heading" className="mt-1 text-xl font-bold text-slate-900">Recent requests</h2></div><Link href="/tickets" className="text-sm font-bold text-blue-600 hover:text-blue-800">View all -&gt;</Link></div><div className="space-y-3">{tickets.slice(0, 3).map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}{!tickets.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No requests yet. Your first one can start here.</div>}</div></section>
    </div>
  </div></Shell>;
}

export function ProfilePage() {
  const { employee, loading, error } = useOfficeFlow();
  return <Shell employee={employee}><PageState loading={loading} error={error} />{!loading && !error && employee && <div className="fade-up mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Profile</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Your account</h1><p className="mt-2 text-slate-500">The identity linked to your OfficeFlow workspace.</p><dl className="mt-8 grid gap-4 sm:grid-cols-2"><ProfileField label="Name" value={employee.name} /><ProfileField label="Email" value={employee.email} /><ProfileField label="Department" value={employee.department} /><ProfileField label="Job role" value={employee.role} /><ProfileField label="Account type" value={employee.appRole} /></dl></div>}</Shell>;
}

function ProfileField({ label: fieldLabel, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(30,41,59,.05)]"><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{fieldLabel}</dt><dd className="mt-2 break-words font-semibold text-slate-800">{value}</dd></div>;
}

export function RequestPage() { const { employee, loading, error, refresh } = useOfficeFlow(); return <Shell employee={employee}><PageState loading={loading} error={error} />{!loading && !error && <div className="fade-up mx-auto max-w-3xl"><Link href="/dashboard" className="text-sm font-bold text-blue-600">&lt;- Back to overview</Link><h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950">Tell us what happened.</h1><p className="mt-2 mb-7 text-slate-500">Give us the useful details. Our support teams will take it from there.</p><RequestForm onSubmitted={refresh} /></div>}</Shell>; }

export function TicketsPage() { const { employee, tickets, loading, error, refresh } = useOfficeFlow(); return <Shell employee={employee}><PageState loading={loading} error={error} />{!loading && !error && <div className="fade-up"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Workspace</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Tickets</h1><p className="mt-2 text-slate-500">Track every workplace request in one place.</p></div><Link href="/request" className="brand-gradient rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200">+ New request</Link></div><TicketTable tickets={tickets} onUpdated={refresh} /></div>}</Shell>; }

export function AdminPage() { const { employee, tickets, loading, error, refresh } = useOfficeFlow(); return <Shell employee={employee}><PageState loading={loading} error={error} />{!loading && !error && employee?.appRole === "ADMIN" && employee.operationalTeam && <div className="fade-up"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600">{employee.operationalTeam} operations</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Admin Console</h1><p className="mt-2 text-slate-500">Review incoming work and keep teams moving.</p></div><a
  href="/api/tickets/export"
  download
  className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200/50 transition hover:from-blue-700 hover:to-purple-700"
>
  Export CSV
</a></div><DashboardStats tickets={tickets} admin />{employee.operationalTeam === "SECURITY" && <ApprovalQueue />}<div className="mt-8"><div className="mb-4"><h2 className="text-xl font-bold text-slate-900">{employee.operationalTeam} Operations</h2><p className="mt-1 text-sm text-slate-500">Manage incoming {employee.operationalTeam.toLowerCase()} work and track resolution.</p></div><TicketTable tickets={tickets} admin adminPath onUpdated={refresh} /></div></div>}</Shell>; }

export function TicketDetailPage({ id, adminPath = false }: { id: string; adminPath?: boolean }) {
  const { employee, loading: shellLoading } = useOfficeFlow();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/tickets/${id}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Ticket not found."); setTicket(data.ticket); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load ticket.")); }, [id]);
  if (shellLoading) return <Shell><PageState loading error="" /></Shell>;
  return <Shell employee={employee}><div className="fade-up mx-auto max-w-3xl"><Link href={adminPath ? "/admin" : "/tickets"} className="text-sm font-bold text-blue-600">&lt;- Back to tickets</Link>{error ? <PageState loading={false} error={error} /> : !ticket ? <PageState loading error="" /> : <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_50px_rgba(30,41,59,.07)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Ticket #{ticket.id} · {ticket.category}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{ticket.title}</h1></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyles[ticket.status] || "bg-slate-100"}`}>{label(ticket.status)}</span></div><p className="mt-7 whitespace-pre-wrap text-[15px] leading-7 text-slate-600">{ticket.description}</p><dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Priority</dt><dd className="mt-1 font-bold text-slate-800">{label(ticket.priority)}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned team</dt><dd className="mt-1 font-bold text-slate-800">{ticket.assignedTeam}</dd></div></dl></article>}</div></Shell>;
}
