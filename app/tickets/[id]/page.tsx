import { TicketDetailPage } from "@/components/AppShell";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <TicketDetailPage id={(await params).id} />;
}
