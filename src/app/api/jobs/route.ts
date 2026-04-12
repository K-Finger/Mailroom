import { after } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const EDGE_FUNCTION_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-job`;

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  // TODO: re-enable before launch
  const AUTH_ENABLED = false;
  if (AUTH_ENABLED && !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user?.id ?? "00000000-0000-0000-0000-000000000000";

  const { inputPaths, inputNames, instructionText, instructionPath, nativePdf } =
    await request.json() as {
      inputPaths: string[];
      inputNames: string[];
      instructionText?: string;
      instructionPath?: string;
      nativePdf?: boolean;
    };

  if (!inputPaths?.length) {
    return NextResponse.json({ error: "No input files" }, { status: 400 });
  }

  // Bypass RLS when auth is disabled for testing
  const insertClient = AUTH_ENABLED
    ? supabase
    : createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

  const { data: job, error } = await insertClient
    .from("jobs")
    .insert({
      user_id: userId,
      status: "pending",
      input_paths: inputPaths,
      input_names: inputNames,
      instruction_text: instructionText ?? null,
      instruction_path: instructionPath ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  after(async () => {
    await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id, nativePdf: nativePdf ?? false }),
    });
  });

  return NextResponse.json({ jobId: job.id });
}
