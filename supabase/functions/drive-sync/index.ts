import {
  supabase,
  getFunctionUrl,
  getServiceRoleKey,
  isInternalRequest,
  jsonResponse,
} from "../_shared/supabase.ts";
import {
  decryptRefreshToken,
  downloadGoogleDriveFile,
  isSupportedSourceFile,
  listGoogleDriveFilesInFolder,
  matchesFileNamePattern,
  refreshGoogleAccessToken,
  sanitizeFilename,
} from "../_shared/google-drive.ts";

const PROCESS_JOB_URL = getFunctionUrl("process-job");
const MAX_FILES_PER_SYNC = 25;
const CLAIMABLE_RUN_STATUSES = ["discovered", "error"] as const;
const CLAIMED_RUN_STATUS = "queued";

function nowIso() {
  return new Date().toISOString();
}

interface ClaimedRun {
  id: string;
  mode: "stage" | "redispatch";
  jobId?: string;
}

async function dispatchJob(jobId: string) {
  const response = await fetch(PROCESS_JOB_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getServiceRoleKey()}`,
    },
    body: JSON.stringify({ jobId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to dispatch process-job");
  }
}

async function claimDriveRun(
  automationId: string,
  file: {
    id: string;
    modifiedTime: string;
    name: string;
    version: string;
  },
): Promise<ClaimedRun | null> {
  const { data: existingRun, error: existingRunError } = await supabase
    .from("drive_file_runs")
    .select("id,status,job_id")
    .eq("automation_id", automationId)
    .eq("drive_file_id", file.id)
    .eq("drive_revision_id", file.version)
    .maybeSingle();

  if (existingRunError) {
    throw new Error(existingRunError.message);
  }

  if (!existingRun) {
    const { data: insertedRun, error: insertError } = await supabase
      .from("drive_file_runs")
      .insert({
        automation_id: automationId,
        drive_file_id: file.id,
        drive_revision_id: file.version,
        drive_modified_time: file.modifiedTime,
        source_file_name: file.name,
        status: CLAIMED_RUN_STATUS,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return null;
      }
      throw new Error(insertError.message);
    }

    return { id: insertedRun.id, mode: "stage" };
  }

  if (!CLAIMABLE_RUN_STATUSES.includes(existingRun.status as (typeof CLAIMABLE_RUN_STATUSES)[number])) {
    return null;
  }

  const updatePayload: Record<string, unknown> = {
    drive_modified_time: file.modifiedTime,
    source_file_name: file.name,
    source_storage_path: null,
    status: CLAIMED_RUN_STATUS,
    error_message: null,
  };

  let updateQuery = supabase
    .from("drive_file_runs")
    .update(updatePayload)
    .eq("id", existingRun.id)
    .in("status", [...CLAIMABLE_RUN_STATUSES]);

  updateQuery = existingRun.job_id
    ? updateQuery.eq("job_id", existingRun.job_id)
    : updateQuery.is("job_id", null);

  const { data: updatedRun, error: updateError } = await updateQuery
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updatedRun) {
    return null;
  }

  if (existingRun.job_id) {
    return { id: updatedRun.id, mode: "redispatch", jobId: existingRun.job_id };
  }

  return { id: updatedRun.id, mode: "stage" };
}

async function requeueRunJob(jobId: string) {
  const { error: jobError } = await supabase
    .from("jobs")
    .update({ status: "pending", error_message: null })
    .eq("id", jobId);

  if (jobError) {
    throw new Error(jobError.message);
  }

  await dispatchJob(jobId);
}

Deno.serve(async (req) => {
  if (!isInternalRequest(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { automationId } = (await req.json()) as { automationId?: string };
    if (!automationId) {
      throw new Error("automationId is required");
    }

    const { data: automation, error: automationError } = await supabase
      .from("drive_automations")
      .select("*")
      .eq("id", automationId)
      .single();
    if (automationError || !automation) {
      throw new Error("Automation not found");
    }

    const [{ data: connection, error: connectionError }, { data: pipeline, error: pipelineError }] =
      await Promise.all([
        supabase
          .from("google_drive_connections")
          .select("*")
          .eq("id", automation.connection_id)
          .single(),
        supabase
          .from("pipelines")
          .select("id,pipeline_steps")
          .eq("id", automation.pipeline_id)
          .single(),
      ]);

    if (connectionError || !connection) {
      throw new Error("Google Drive connection not found");
    }
    if (pipelineError || !pipeline) {
      throw new Error("Pipeline not found");
    }

    const refreshToken = await decryptRefreshToken(connection.encrypted_refresh_token);
    const token = await refreshGoogleAccessToken(refreshToken);
    const files = await listGoogleDriveFilesInFolder(token.access_token, automation.source_folder_id);

    let scanned = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of files) {
      if (scanned >= MAX_FILES_PER_SYNC) {
        break;
      }

      if (!isSupportedSourceFile(file)) {
        skipped++;
        continue;
      }

      if (
        Array.isArray(automation.mime_type_filter) &&
        automation.mime_type_filter.length > 0 &&
        !automation.mime_type_filter.includes(file.mimeType)
      ) {
        skipped++;
        continue;
      }

      if (!matchesFileNamePattern(file.name, automation.file_name_pattern)) {
        skipped++;
        continue;
      }

      scanned++;

      let claimedRun: ClaimedRun | null = null;
      try {
        claimedRun = await claimDriveRun(automation.id, file);
      } catch (claimError) {
        console.error("drive-sync claim failed", claimError);
        errors++;
        continue;
      }

      if (!claimedRun) {
        skipped++;
        continue;
      }

      let stagedPath: string | null = null;
      let createdJobId: string | null = null;

      try {
        if (claimedRun.mode === "redispatch") {
          try {
            await requeueRunJob(claimedRun.jobId!);
          } catch (dispatchError) {
            const message = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
            await Promise.all([
              supabase
                .from("drive_file_runs")
                .update({ status: "error", error_message: message })
                .eq("id", claimedRun.id),
              supabase
                .from("jobs")
                .update({ status: "error", error_message: message })
                .eq("id", claimedRun.jobId!),
            ]);
            throw dispatchError;
          }

          created++;
          continue;
        }

        const bytes = await downloadGoogleDriveFile(token.access_token, file.id);
        const storagePath = `${automation.user_id}/drive/${automation.id}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
        stagedPath = storagePath;

        const { error: uploadError } = await supabase.storage
          .from("source-files")
          .upload(storagePath, bytes, {
            contentType: file.mimeType,
            upsert: false,
          });
        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .insert({
            user_id: automation.user_id,
            status: "pending",
            input_paths: [storagePath],
            input_names: [file.name],
            pipeline_steps: pipeline.pipeline_steps ?? [],
          })
          .select("id")
          .single();
        if (jobError || !job) {
          throw new Error(jobError?.message ?? "Failed to create job");
        }
        createdJobId = job.id;

        const { error: updateRunError } = await supabase
          .from("drive_file_runs")
          .update({
            source_storage_path: storagePath,
            source_file_name: file.name,
            job_id: job.id,
            status: "queued",
            error_message: null,
          })
          .eq("id", claimedRun.id);
        if (updateRunError) {
          throw new Error(updateRunError.message);
        }

        try {
          await dispatchJob(job.id);
        } catch (dispatchError) {
          const message = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
          await Promise.all([
            supabase
              .from("drive_file_runs")
              .update({ status: "error", error_message: message })
              .eq("id", claimedRun.id),
            supabase
              .from("jobs")
              .update({ status: "error", error_message: message })
              .eq("id", job.id),
          ]);
          throw dispatchError;
        }

        created++;
      } catch (error) {
        errors++;
        if (claimedRun.mode === "stage" && stagedPath && !createdJobId) {
          await supabase.storage.from("source-files").remove([stagedPath]);
        }
        await supabase
          .from("drive_file_runs")
          .update({
            status: "error",
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq("id", claimedRun.id);
      }
    }

    await supabase
      .from("drive_automations")
      .update({ last_scan_at: nowIso() })
      .eq("id", automation.id);

    return jsonResponse({ scanned, created, skipped, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});
