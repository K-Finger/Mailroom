import { supabase, isInternalRequest, jsonResponse } from "../_shared/supabase.ts";
import {
  buildExportFilename,
  decryptRefreshToken,
  guessContentType,
  refreshGoogleAccessToken,
  uploadGoogleDriveFile,
} from "../_shared/google-drive.ts";

type ResultPath = { nodeId: string; path: string };
const CLAIMABLE_EXPORT_STATUSES = ["awaiting_export", "export_error"] as const;

async function claimRunForExport(runId: string) {
  const { data, error } = await supabase
    .from("drive_file_runs")
    .update({ status: "exporting", error_message: null })
    .eq("id", runId)
    .in("status", [...CLAIMABLE_EXPORT_STATUSES])
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

Deno.serve(async (req) => {
  if (!isInternalRequest(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { automationId, jobId } = (await req.json()) as {
      automationId?: string;
      jobId?: string;
    };

    if (!automationId && !jobId) {
      throw new Error("automationId or jobId is required");
    }

    let query = supabase
      .from("drive_file_runs")
      .select("*")
      .in("status", [...CLAIMABLE_EXPORT_STATUSES]);

    if (jobId) {
      query = query.eq("job_id", jobId);
    }
    if (automationId) {
      query = query.eq("automation_id", automationId);
    }

    const { data: runs, error: runsError } = await query.order("updated_at", { ascending: true });
    if (runsError) {
      throw new Error(runsError.message);
    }

    const pendingRuns = runs ?? [];
    if (pendingRuns.length === 0) {
      return jsonResponse({ exported: 0, failed: 0, pending: 0 });
    }

    const automationIds = [...new Set(pendingRuns.map((run) => run.automation_id))];
    const { data: automations, error: automationError } = await supabase
      .from("drive_automations")
      .select("*")
      .in("id", automationIds);
    if (automationError) {
      throw new Error(automationError.message);
    }

    const connectionIds = [...new Set((automations ?? []).map((automation) => automation.connection_id))];
    const { data: connections, error: connectionError } = await supabase
      .from("google_drive_connections")
      .select("*")
      .in("id", connectionIds);
    if (connectionError) {
      throw new Error(connectionError.message);
    }

    const automationMap = new Map((automations ?? []).map((automation) => [automation.id, automation]));
    const connectionMap = new Map((connections ?? []).map((connection) => [connection.id, connection]));
    const accessTokenCache = new Map<string, string>();

    let exported = 0;
    let failed = 0;

    for (const run of pendingRuns) {
      const automation = automationMap.get(run.automation_id);
      const connection = automation ? connectionMap.get(automation.connection_id) : null;

      const claimed = await claimRunForExport(run.id);
      if (!claimed) {
        continue;
      }

      if (!automation || !connection) {
        failed++;
        await supabase
          .from("drive_file_runs")
          .update({ status: "export_error", error_message: "Missing automation or connection" })
          .eq("id", run.id);
        continue;
      }

      try {
        let accessToken = accessTokenCache.get(connection.id);
        if (!accessToken) {
          const refreshToken = await decryptRefreshToken(connection.encrypted_refresh_token);
          const token = await refreshGoogleAccessToken(refreshToken);
          accessToken = token.access_token;
          accessTokenCache.set(connection.id, accessToken);
        }

        const resultPaths = (run.result_paths ?? []) as ResultPath[];
        const firstResult = resultPaths[0];
        if (!firstResult?.path) {
          throw new Error("Run has no result artifact to export");
        }

        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from("results")
          .download(firstResult.path);
        if (downloadError || !fileBlob) {
          throw new Error(downloadError?.message ?? "Failed to download result file");
        }

        const resultBytes = new Uint8Array(await fileBlob.arrayBuffer());
        const filename = buildExportFilename(run.source_file_name, firstResult.path);
        const uploaded = await uploadGoogleDriveFile({
          accessToken,
          folderId: automation.output_folder_id,
          filename,
          bytes: resultBytes,
          contentType: fileBlob.type || guessContentType(filename),
        });

        await supabase
          .from("drive_file_runs")
          .update({
            status: "completed",
            exported_drive_file_id: uploaded.id,
            exported_drive_file_name: uploaded.name,
            error_message: null,
          })
          .eq("id", run.id);

        exported++;
      } catch (error) {
        failed++;
        await supabase
          .from("drive_file_runs")
          .update({
            status: "export_error",
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq("id", run.id);
      }
    }

    return jsonResponse({ exported, failed, pending: pendingRuns.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});
