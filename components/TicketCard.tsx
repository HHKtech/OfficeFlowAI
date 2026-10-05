import Link from "next/link";

export type Ticket = { id: number; category: string; subcategory?: string | null; title: string; description: string; priority: string; status: string; assignedTeam: string; assignedTo?: string | null; requiresApproval: boolean; approvalStatus: string; createdAt: string; updatedAt: string; employee?: { id: number; name: string; email: string } };

const statusStyles: Record<string, string> = { OPEN: "bg-blue-50 text-blue-700", ASSIGNED: "bg-violet-50 text-violet-700", IN_PROGRESS: "bg-amber-50 text-amber-700", AWAITING_APPROVAL: "bg-pink-50 text-pink-700", RESOLVED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-rose-50 text-rose-700" };
const priorityStyles: Record<string, string> = { LOW: "text-slate-500", MEDIUM: "text-blue-600", HIGH: "text-orange-600", CRITICAL: "text-rose-600" };
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase());

export function TicketCard({ ticket }: { ticket: Ticket }) {
	return <Link href={`/tickets/${ticket.id}`} className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">#{ticket.id} · {ticket.category}</p><h3 className="truncate font-bold text-slate-900 group-hover:text-blue-700">{ticket.title}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[ticket.status] || "bg-slate-100 text-slate-600"}`}>{label(ticket.status)}</span></div><p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-500">{ticket.description}</p><div className="mt-4 flex items-center justify-between text-xs"><span className={`font-bold ${priorityStyles[ticket.priority] || "text-slate-500"}`}>{label(ticket.priority)} priority</span><span className="text-slate-400">{new Date(ticket.createdAt).toLocaleDateString()}</span></div></Link>;
}

export { label, statusStyles, priorityStyles };
