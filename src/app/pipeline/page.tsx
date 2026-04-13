import { requireAppUser } from "@/lib/auth/server";
import { listPipelinesForUser } from "@/lib/automations/server";
import { Pipeline } from "@/components/pipeline/Pipeline";

export default async function PipelinePage() {
  const appUser = await requireAppUser();
  const pipelines = await listPipelinesForUser(appUser.userId);

  return (
    <div className="h-screen overflow-hidden">
      <Pipeline initialPipelines={pipelines} />
    </div>
  );
}
