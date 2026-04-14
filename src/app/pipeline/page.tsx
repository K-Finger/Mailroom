import { createClient } from "@/lib/supabase/server";
import { Pipeline } from "@/components/pipeline/Pipeline";

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ count }, { data: profile }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user?.id ?? "")
      .eq("status", "done")
      .gte("created_at", startOfMonth.toISOString()),
    supabase
      .from("users")
      .select("paid")
      .eq("id", user?.id ?? "")
      .single(),
  ]);

  const isPaid = profile?.paid ?? false;

  return (
    <div className="h-screen overflow-hidden">
      <Pipeline user={user} docsThisMonth={count ?? 0} isPaid={isPaid} />
    </div>
  );
}
