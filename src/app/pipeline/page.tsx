import { createClient } from "@/lib/supabase/server";
import { Pipeline } from "@/components/pipeline/Pipeline";

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="h-screen overflow-hidden">
      <Pipeline user={user} />
    </div>
  );
}
