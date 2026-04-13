import { after } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PipelineStep } from "@/store/pipeline";

const EDGE_FUNCTION_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-job`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inputPaths, inputNames, pipelineSteps } = await request.json() as {
    inputPaths: string[];
    inputNames: string[];
    pipelineSteps: PipelineStep[];
  };

  if (!inputPaths?.length) {
    return NextResponse.json({ error: "No input files" }, { status: 400 });
  }

  if (process.env.BILLING_ENABLED === "true") {
    const { data: profile } = await supabase
      .from("users")
      .select("stripe_subscription_status")
      .eq("id", user.id)
      .single();
    const status = profile?.stripe_subscription_status;
    if (status !== "active" && status !== "trialing") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 402 });
    }
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
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
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    });
    if (!res.ok) {
      const serviceClient = (await import("@supabase/supabase-js")).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      await serviceClient
        .from("jobs")
        .update({ status: "error", error_message: "Failed to start processing" })
        .eq("id", job.id);
    }
  });

  return NextResponse.json({ jobId: job.id });
}
