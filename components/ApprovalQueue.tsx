"use client";

import { useEffect, useState } from "react";

type Approval = {
  id: number;
  title: string;
  priority: string;
  risk: string;
  employeeRequest: string;
  recommendation: string;
  employee: { name: string; email: string };
};

const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase());

export function ApprovalQueue() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);

  async function loadQueue() {
    const response = await fetch("/api/approvals", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load approval queue.");
    setApprovals(data.approvals);
  }

  useEffect(() => {
    async function bootstrapQueue() {
      try {
        await loadQueue();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load approval queue.");
      } finally {
        setLoading(false);
      }
    }

    void bootstrapQueue();
  }, []);

  async function decide(id: number, decision: "APPROVED" | "REJECTED") {
    setUpdating(id);
    setError("");
    try {
      const response = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update approval.");
      setApprovals((current) => current.filter((approval) => approval.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update approval.");
      await loadQueue().catch(() => undefined);
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Loading approval queue...</div>;
  if (error && !approvals.length) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</div>;

  return <section aria-labelledby="approval-queue-heading" className="mt-8">
    <div className="mb-4 flex items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-600">Human approval</p><h2 id="approval-queue-heading" className="mt-1 text-xl font-bold text-slate-900">Approval Queue</h2><p className="mt-1 text-sm text-slate-500">Security requests paused until you decide.</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{approvals.length} pending</span>
    </div>
    {error && <p className="mb-3 text-sm font-semibold text-rose-700">{error}</p>}
    {!approvals.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No security requests are waiting for approval.</div> : <div className="space-y-4">{approvals.map((approval) => <article key={approval.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ticket #{approval.id} · Security</p><h3 className="mt-1 text-lg font-bold text-slate-900">{approval.title}</h3></div><span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">{label(approval.risk)} risk</span></div><dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2"><div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Employee request</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{approval.employeeRequest}</dd><p className="mt-2 text-xs text-slate-500">{approval.employee.name} · {approval.employee.email}</p></div><div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI recommendation</dt><dd className="mt-1 text-sm leading-6 text-slate-700">{approval.recommendation}</dd></div></dl><div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" disabled={updating === approval.id} onClick={() => void decide(approval.id, "REJECTED")} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button><button type="button" disabled={updating === approval.id} onClick={() => void decide(approval.id, "APPROVED")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button></div></article>)}</div>}
  </section>;
}