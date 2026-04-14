import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const EDGE_FUNCTION_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-job`;

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const SUPPORTED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/vnd.google-apps.spreadsheet",
  "text/plain",
];

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Google token");
  const { access_token } = await res.json() as { access_token: string };
  return access_token;
}

async function listNewDriveFiles(
  folderId: string,
  processedIds: string[],
  token: string,
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const mimeQuery = SUPPORTED_MIMES.map((m) => `mimeType = '${m}'`).join(" or ");
  const q = `(${mimeQuery}) and '${folderId}' in parents and trashed = false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=50`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const { files } = await res.json() as { files: Array<{ id: string; name: string; mimeType: string }> };

  const processedSet = new Set(processedIds);
  return (files ?? []).filter((f) => !processedSet.has(f.id));
}

async function downloadDriveFile(file: { id: string; name: string; mimeType: string }, token: string): Promise<{ buffer: Buffer; name: string; mimeType: string }> {
  let url: string;
  let name = file.name;
  let mimeType = file.mimeType;

  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    url = `${DRIVE_API}/files/${file.id}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`;
    name = `${file.name}.xlsx`;
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    url = `${DRIVE_API}/files/${file.id}?alt=media`;
  }

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, name, mimeType };
}

export async function GET(request: Request) {
  // Verify cron secret
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Load all enabled watchers with their user's refresh token
  const { data: watchers, error } = await serviceClient
    .from("drive_watchers")
    .select("id, user_id, folder_id, folder_name, pipeline_steps, processed_file_ids")
    .eq("enabled", true);

  if (error) {
    console.error("Failed to load watchers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!watchers?.length) return NextResponse.json({ checked: 0 });

  const results: Array<{ watcherId: string; newFiles: number; error?: string }> = [];

  for (const watcher of watchers) {
    try {
      // Get user's Google refresh token
      const { data: userRow } = await serviceClient
        .from("users")
        .select("google_refresh_token, google_access_token")
        .eq("id", watcher.user_id)
        .single();

      if (!userRow?.google_refresh_token) {
        results.push({ watcherId: watcher.id, newFiles: 0, error: "No refresh token" });
        continue;
      }

      // Get a fresh access token
      let accessToken: string;
      try {
        accessToken = await refreshGoogleToken(userRow.google_refresh_token);
        // Update stored access token
        await serviceClient.from("users").update({ google_access_token: accessToken }).eq("id", watcher.user_id);
      } catch {
        // Fall back to stored token
        if (!userRow.google_access_token) {
          results.push({ watcherId: watcher.id, newFiles: 0, error: "Token refresh failed" });
          continue;
        }
        accessToken = userRow.google_access_token;
      }

      // Find new files
      const newFiles = await listNewDriveFiles(watcher.folder_id, watcher.processed_file_ids ?? [], accessToken);

      if (!newFiles.length) {
        await serviceClient.from("drive_watchers").update({ last_checked_at: new Date().toISOString() }).eq("id", watcher.id);
        results.push({ watcherId: watcher.id, newFiles: 0 });
        continue;
      }

      const newProcessedIds = [...(watcher.processed_file_ids ?? [])];

      for (const driveFile of newFiles) {
        try {
          // Check credits before processing
          if (process.env.BILLING_ENABLED === "true") {
            const { data: hasCredits } = await serviceClient.rpc("deduct_credit", { user_id: watcher.user_id });
            if (!hasCredits) {
              console.log(`User ${watcher.user_id} out of credits, skipping watcher ${watcher.id}`);
              break;
            }
          }

          // Download file
          const { buffer, name, mimeType } = await downloadDriveFile(driveFile, accessToken);

          // Upload to Supabase Storage
          const ext = name.split(".").pop() ?? "bin";
          const storagePath = `${watcher.user_id}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await serviceClient.storage
            .from("source-files")
            .upload(storagePath, buffer, { contentType: mimeType });

          if (uploadError) {
            console.error(`Upload failed for ${name}:`, uploadError);
            continue;
          }

          // Create job
          const { data: job, error: jobError } = await serviceClient
            .from("jobs")
            .insert({
              user_id: watcher.user_id,
              status: "pending",
              input_paths: [storagePath],
              input_names: [name],
              pipeline_steps: watcher.pipeline_steps,
            })
            .select("id")
            .single();

          if (jobError || !job) {
            console.error(`Job insert failed:`, jobError);
            continue;
          }

          // Fire Edge Function
          await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ jobId: job.id }),
          });

          newProcessedIds.push(driveFile.id);
        } catch (fileErr) {
          console.error(`Error processing file ${driveFile.name}:`, fileErr);
        }
      }

      // Update watcher state
      await serviceClient
        .from("drive_watchers")
        .update({ last_checked_at: new Date().toISOString(), processed_file_ids: newProcessedIds })
        .eq("id", watcher.id);

      results.push({ watcherId: watcher.id, newFiles: newFiles.length });
    } catch (watcherErr) {
      console.error(`Watcher ${watcher.id} failed:`, watcherErr);
      results.push({ watcherId: watcher.id, newFiles: 0, error: String(watcherErr) });
    }
  }

  return NextResponse.json({ checked: watchers.length, results });
}
