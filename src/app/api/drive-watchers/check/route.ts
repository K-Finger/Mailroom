import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-job`;
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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: watchers, error } = await serviceClient
    .from("drive_watchers")
    .select("id, folder_id, folder_name, pipeline_steps, processed_file_ids")
    .eq("user_id", user.id)
    .eq("enabled", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!watchers?.length) return NextResponse.json({ checked: 0, newFiles: 0 });

  if (process.env.BILLING_ENABLED === "true") {
    const { data: profile } = await serviceClient
      .from("users")
      .select("paid")
      .eq("id", user.id)
      .single();
    if (!profile?.paid) {
      return NextResponse.json({ error: "No active subscription" }, { status: 402 });
    }
  }

  const { data: userRow } = await serviceClient
    .from("users")
    .select("google_refresh_token, google_access_token")
    .eq("id", user.id)
    .single();

  if (!userRow?.google_refresh_token) {
    return NextResponse.json({ error: "No Google token — reconnect your account" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await refreshGoogleToken(userRow.google_refresh_token);
    await serviceClient.from("users").update({ google_access_token: accessToken }).eq("id", user.id);
  } catch {
    if (!userRow.google_access_token) {
      return NextResponse.json({ error: "Google token refresh failed" }, { status: 400 });
    }
    accessToken = userRow.google_access_token;
  }

  let totalNew = 0;

  for (const watcher of watchers) {
    const mimeQuery = SUPPORTED_MIMES.map((m) => `mimeType = '${m}'`).join(" or ");
    const q = `(${mimeQuery}) and '${watcher.folder_id}' in parents and trashed = false`;
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=50`;

    const listRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listRes.ok) continue;

    const { files } = await listRes.json() as { files: Array<{ id: string; name: string; mimeType: string }> };
    const processedSet = new Set(watcher.processed_file_ids ?? []);
    const newFiles = (files ?? []).filter((f) => !processedSet.has(f.id));

    if (!newFiles.length) {
      await serviceClient.from("drive_watchers").update({ last_checked_at: new Date().toISOString() }).eq("id", watcher.id);
      continue;
    }

    const newProcessedIds = [...(watcher.processed_file_ids ?? [])];

    for (const driveFile of newFiles) {
      try {
        let downloadUrl: string;
        let name = driveFile.name;
        let mimeType = driveFile.mimeType;

        if (driveFile.mimeType === "application/vnd.google-apps.spreadsheet") {
          downloadUrl = `${DRIVE_API}/files/${driveFile.id}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`;
          name = `${driveFile.name}.xlsx`;
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        } else {
          downloadUrl = `${DRIVE_API}/files/${driveFile.id}?alt=media`;
        }

        const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!fileRes.ok) continue;

        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const ext = name.split(".").pop() ?? "bin";
        const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await serviceClient.storage
          .from("source-files")
          .upload(storagePath, buffer, { contentType: mimeType });

        if (uploadError) continue;

        const { data: job, error: jobError } = await serviceClient
          .from("jobs")
          .insert({
            user_id: user.id,
            status: "pending",
            input_paths: [storagePath],
            input_names: [name],
            pipeline_steps: watcher.pipeline_steps,
          })
          .select("id")
          .single();

        if (jobError || !job) continue;

        await fetch(EDGE_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ jobId: job.id }),
        });

        newProcessedIds.push(driveFile.id);
        totalNew++;
      } catch {
        // continue to next file
      }
    }

    await serviceClient
      .from("drive_watchers")
      .update({ last_checked_at: new Date().toISOString(), processed_file_ids: newProcessedIds })
      .eq("id", watcher.id);
  }

  return NextResponse.json({ checked: watchers.length, newFiles: totalNew });
}
