import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("status, result_paths, error_message, user_id")
    .eq("user_id", appUser.userId)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  if (data.status === "done" && Array.isArray(data.result_paths)) {
    const signedResults = await Promise.all(
      data.result_paths.map(async ({ nodeId, path }: { nodeId: string; path: string }) => {
        const { data: urlData } = await supabase.storage
          .from("results")
          .createSignedUrl(path, 60 * 5);
        return { nodeId, path, url: urlData?.signedUrl ?? null };
      }),
    );
    return NextResponse.json({ ...data, results: signedResults });
  }

  return NextResponse.json(data);
}
