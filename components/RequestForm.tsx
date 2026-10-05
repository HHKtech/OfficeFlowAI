"use client";

import { FormEvent, useState } from "react";
import { AgentWorkflow } from "./AgentWorkflow";

export type RequestResult = {
	requestId: string;
	issuesDetected: number;
	agentsUsed: string[];
	ticketsCreated: string[];
	requiresApproval: boolean;
	finalResponse: string;
};

export function RequestForm({ onSubmitted }: { onSubmitted?: () => void }) {
	const [description, setDescription] = useState("");
	const [result, setResult] = useState<RequestResult | null>(null);
	const [submittedRequest, setSubmittedRequest] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const value = description.trim();
		if (!value) { setError("Tell us what is going wrong before sending."); return; }
		setLoading(true); setError(""); setResult(null);
		try {
			const response = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: value }) });
			const data = await response.json() as RequestResult & { error?: string };
			if (!response.ok) throw new Error(data.error || "We could not process that request.");
			setResult(data); setSubmittedRequest(value); setDescription(""); onSubmitted?.();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "We could not process that request.");
		} finally { setLoading(false); }
	}

	return (
		<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(30,41,59,.07)] sm:p-7">
			<div className="mb-5 flex items-start justify-between gap-4">
				<div><p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-blue-600">Start a request</p><h2 className="text-xl font-bold text-slate-900">What can we help with?</h2></div>
				<span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 sm:block">AI-assisted support</span>
			</div>
			<form onSubmit={submit}>
				<label htmlFor="problem" className="sr-only">Describe your workplace problem</label>
				<textarea id="problem" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} rows={5} placeholder="e.g. My laptop won't connect to the office Wi-Fi." className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
				<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-400">{description.length.toLocaleString()} / 10,000 characters</span><button disabled={loading} className="brand-gradient rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{loading ? "Routing your request..." : "Send request"}</button></div>
			</form>
			{error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
			{result && <AgentWorkflow request={submittedRequest} result={result} />}
		</section>
	);
}
