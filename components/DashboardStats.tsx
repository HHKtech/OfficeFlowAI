import { Ticket } from "./TicketCard";

export function DashboardStats({ tickets, admin = false }: { tickets: Ticket[]; admin?: boolean }) {
	const open = tickets.filter((ticket) => !["RESOLVED", "REJECTED"].includes(ticket.status)).length;
	const resolved = tickets.filter((ticket) => ticket.status === "RESOLVED").length;
	const waiting = tickets.filter((ticket) => ticket.status === "AWAITING_APPROVAL").length;
	return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[admin ? "Total tickets" : "Total requests", tickets.length, "text-blue-600"], ["Active", open, "text-violet-600"], ["Awaiting approval", waiting, "text-pink-600"], ["Resolved", resolved, "text-emerald-600"]].map(([title, value, color]) => <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{title}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></div>)}</div>;
}
