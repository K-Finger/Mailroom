import { requireAppUser } from "@/lib/auth/server";
import { loadAutomationPageData } from "@/lib/automations/server";
import { AutomationManager } from "@/components/automations/AutomationManager";

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const appUser = await requireAppUser();
  const data = await loadAutomationPageData(appUser.userId);
  const { connected, error } = await searchParams;

  return (
    <AutomationManager
      pipelines={data.pipelines}
      connections={data.connections}
      automations={data.automations}
      runs={data.runs}
      connected={connected === "1"}
      error={error ?? null}
    />
  );
}
