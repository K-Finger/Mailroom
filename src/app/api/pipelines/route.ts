import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPipelinesForUser } from "@/lib/automations/server";
import type { PersistedPipelineNode } from "@/lib/pipeline/workflow";
import type { PipelineEdge, PipelineStep } from "@/store/pipeline";

interface PipelineRequestBody {
  id?: string;
  name: string;
  nodes: PersistedPipelineNode[];
  edges: PipelineEdge[];
  pipelineSteps: PipelineStep[];
}

export async function GET() {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pipelines = await listPipelinesForUser(appUser.userId);
    return NextResponse.json({ pipelines });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load pipelines" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, nodes, edges, pipelineSteps } = (await request.json()) as PipelineRequestBody;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Pipeline name is required" }, { status: 400 });
  }

  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(pipelineSteps)) {
    return NextResponse.json({ error: "Invalid pipeline payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const payload = {
    user_id: appUser.userId,
    name: name.trim(),
    nodes,
    edges,
    pipeline_steps: pipelineSteps,
  };

  try {
    const query = id
      ? admin
          .from("pipelines")
          .update(payload)
          .eq("user_id", appUser.userId)
          .eq("id", id)
      : admin.from("pipelines").insert(payload);

    const { data, error } = await query
      .select("id,name,nodes,edges,pipeline_steps,created_at,updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ pipeline: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save pipeline" },
      { status: 500 },
    );
  }
}
