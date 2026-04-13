import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getGoogleDriveConnectionForUser,
  getPipelineForUser,
  listDriveAutomationsForUser,
} from "@/lib/automations/server";

interface AutomationRequestBody {
  id?: string;
  connectionId: string;
  pipelineId: string;
  sourceFolderId: string;
  outputFolderId: string;
  fileNamePattern?: string | null;
  mimeTypeFilter?: string[] | string | null;
  enabled?: boolean;
}

function normalizeMimeTypeFilter(input: AutomationRequestBody["mimeTypeFilter"]) {
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((item) => item.trim()).filter(Boolean)));
  }
  if (typeof input === "string") {
    return Array.from(
      new Set(
        input
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }
  return [] as string[];
}

export async function GET() {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const automations = await listDriveAutomationsForUser(appUser.userId);
    return NextResponse.json({ automations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load automations" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    id,
    connectionId,
    pipelineId,
    sourceFolderId,
    outputFolderId,
    fileNamePattern,
    mimeTypeFilter,
    enabled = true,
  } = (await request.json()) as AutomationRequestBody;

  if (!connectionId || !pipelineId || !sourceFolderId || !outputFolderId) {
    return NextResponse.json({ error: "Missing required automation fields" }, { status: 400 });
  }

  if (sourceFolderId === outputFolderId) {
    return NextResponse.json(
      { error: "Source and output folders must be different" },
      { status: 400 },
    );
  }

  try {
    const [, pipeline] = await Promise.all([
      getGoogleDriveConnectionForUser(appUser.userId, connectionId),
      getPipelineForUser(appUser.userId, pipelineId),
    ]);
    const outputSteps = pipeline.pipeline_steps.filter((step) => step.type === "output");
    if (outputSteps.length !== 1) {
      return NextResponse.json(
        { error: "Automation V1 requires a saved pipeline with exactly one output node" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const payload = {
      user_id: appUser.userId,
      connection_id: connectionId,
      pipeline_id: pipelineId,
      source_folder_id: sourceFolderId,
      output_folder_id: outputFolderId,
      file_name_pattern: fileNamePattern?.trim() || null,
      mime_type_filter: normalizeMimeTypeFilter(mimeTypeFilter),
      enabled,
    };

    const query = id
      ? admin
          .from("drive_automations")
          .update(payload)
          .eq("user_id", appUser.userId)
          .eq("id", id)
      : admin.from("drive_automations").insert(payload);

    const { data, error } = await query.select("*").single();
    if (error) {
      throw error;
    }

    return NextResponse.json({ automation: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save automation" },
      { status: 500 },
    );
  }
}
