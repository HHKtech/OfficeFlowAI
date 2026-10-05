import { TicketDetailPage } from "@/components/AppShell";
import { requireAdminTeam } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const result = await requireAdminTeam();
	if (result instanceof Response) redirect("/dashboard");
	return <TicketDetailPage id={(await params).id} adminPath />;
}
