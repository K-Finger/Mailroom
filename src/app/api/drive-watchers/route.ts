import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PipelineStep } from "@/store/pipeline";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("drive_watchers")
    .select("id, folder_id, folder_name, enabled, last_checked_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchers: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { folderId, folderName, pipelineSteps } = await request.json() as {
    folderId: string;
    folderName: string;
    pipelineSteps: PipelineStep[];
  };

  if (!folderId || !folderName) {
    return NextResponse.json({ error: "Missing folderId or folderName" }, { status: 400 });
  }

  // Upsert — one watcher per folder per user
  const { data, error } = await supabase
    .from("drive_watchers")
    .upsert(
      { user_id: user.id, folder_id: folderId, folder_name: folderName, pipeline_steps: pipelineSteps, enabled: true },
      { onConflict: "user_id,folder_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watcherId: data.id });
}
