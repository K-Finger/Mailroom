import { after } from "next/server";
import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PipelineStep } from "@/store/pipeline";

const EDGE_FUNCTION_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-job`;

export async function POST(request: Request) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inputPaths, inputNames, pipelineSteps } = await request.json() as {
    inputPaths: string[];
    inputNames: string[];
    pipelineSteps: PipelineStep[];
  };

  if (!inputPaths?.length) {
    return NextResponse.json({ error: "No input files" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: job, error } = await admin
    .from("jobs")
    .insert({
      user_id: appUser.userId,
      status: "pending",
      input_paths: inputPaths,
      input_names: inputNames,
      pipeline_steps: pipelineSteps,
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
      body: JSON.stringify({ jobId: job.id }),
    });
  });

  return NextResponse.json({ jobId: job.id });
}
