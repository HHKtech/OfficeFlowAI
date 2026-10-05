import Link from "next/link";
import type { RequestResult } from "./RequestForm";

type AgentWorkflowProps = {
	request: string;
	result: RequestResult;
};

function displayAgentName(agent: string) {
	const normalized = agent.trim();
	if (!normalized) return "Specialized agent";
	return normalized.toLowerCase().endsWith("agent") ? normalized : `${normalized} Agent`;
}

function StageConnector() {
	return <div className="hidden h-8 items-center justify-center text-xl font-bold text-blue-300 sm:flex" aria-hidden="true">↓</div>;
}

export function AgentWorkflow({ request, result }: AgentWorkflowProps) {
	return (
		<section aria-labelledby="workflow-heading" className="mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-slate-50/80">
			<div className="border-b border-blue-100 bg-white/80 px-4 py-4 sm:px-5">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-600">Agent workflow</p>
						<h3 id="workflow-heading" className="mt-1 text-lg font-bold text-slate-900">What happened to your request</h3>
					</div>
				</div>
			</div>

			<div className="p-4 sm:p-5">
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Employee request</p>
					<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{request}</p>
				</div>

				<StageConnector />

				<div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
					<p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Orchestrator</p>
					<p className="mt-1 font-bold text-slate-900">Request analyzed and routed</p>
					<p className="mt-1 text-sm text-slate-600">{result.issuesDetected} issue{result.issuesDetected === 1 ? "" : "s"} detected</p>
				</div>

				<StageConnector />

				<div className="grid gap-3 sm:grid-cols-2">
					{result.agentsUsed.map((agent) => (
						<div key={agent} className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
							<p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Specialized agent</p>
							<p className="mt-1 font-bold text-slate-900">{displayAgentName(agent)}</p>
							<p className="mt-2 text-sm text-slate-500">Reported as used for this request.</p>
						</div>
					))}
					{!result.agentsUsed.length && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No specialized agent was reported.</div>}
				</div>

				<StageConnector />

				<div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Created tickets</p>
							<p className="mt-1 font-bold text-slate-900">{result.ticketsCreated.length} ticket{result.ticketsCreated.length === 1 ? "" : "s"} returned</p>
						</div>
						{result.requiresApproval && <span className="rounded-full bg-pink-100 px-3 py-1.5 text-xs font-bold text-pink-700">Admin approval required</span>}
					</div>
					{result.ticketsCreated.length > 0 ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{result.ticketsCreated.map((ticketId) => <Link key={ticketId} href={`/tickets/${ticketId}`} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 hover:border-blue-400 hover:text-blue-900">Ticket #{ticketId}</Link>)}
						</div>
					) : <p className="mt-2 text-sm text-slate-600">No ticket was created for this request.</p>}
				</div>

				<p className="mt-4 text-sm leading-6 text-slate-600">{result.finalResponse}</p>
			</div>
		</section>
	);
}
