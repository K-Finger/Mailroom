import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("jobs")
    .select("status, result_path, error_message")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  if (data.status === "done" && data.result_path) {
    const { data: urlData } = await supabase.storage
      .from("results")
      .createSignedUrl(data.result_path, 60 * 5);
    return NextResponse.json({ ...data, result_url: urlData?.signedUrl ?? null });
  }

  return NextResponse.json(data);
}
