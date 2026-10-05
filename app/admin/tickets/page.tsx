import { AdminPage } from "@/components/AppShell";
import { requireAdminTeam } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function Page() {
	const result = await requireAdminTeam();
	if (result instanceof Response) redirect("/dashboard");
	return <AdminPage />;
}
