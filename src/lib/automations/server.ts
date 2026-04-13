import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SavedPipelineRecord } from "@/lib/pipeline/workflow";
import type { PipelineStep } from "@/store/pipeline";

export interface GoogleDriveConnectionRecord {
  id: string;
  user_id: string;
  google_account_id: string;
  scopes: string[];
  email: string;
  created_at: string;
  updated_at: string;
}

export interface GoogleDriveConnectionSecretRecord extends GoogleDriveConnectionRecord {
  encrypted_refresh_token: string;
}

export interface DriveAutomationRecord {
  id: string;
  user_id: string;
  connection_id: string;
  pipeline_id: string;
  source_folder_id: string;
  output_folder_id: string;
  file_name_pattern: string | null;
  mime_type_filter: string[];
  enabled: boolean;
  last_scan_at: string | null;
  last_cursor: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriveFileRunRecord {
  id: string;
  automation_id: string;
  drive_file_id: string;
  drive_revision_id: string;
  drive_modified_time: string | null;
  source_storage_path: string | null;
  source_file_name: string | null;
  job_id: string | null;
  result_paths: Array<{ nodeId: string; path: string }>;
  exported_drive_file_id: string | null;
  exported_drive_file_name: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationPageData {
  pipelines: SavedPipelineRecord[];
  connections: GoogleDriveConnectionRecord[];
  automations: DriveAutomationRecord[];
  runs: DriveFileRunRecord[];
}

export async function listPipelinesForUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pipelines")
    .select("id,name,nodes,edges,pipeline_steps,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SavedPipelineRecord[];
}

export async function listGoogleDriveConnectionsForUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_drive_connections")
    .select("id,user_id,google_account_id,email,scopes,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GoogleDriveConnectionRecord[];
}

export async function listDriveAutomationsForUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("drive_automations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DriveAutomationRecord[];
}

async function listRecentDriveRunsForAutomationIds(automationIds: string[], limit = 25) {
  if (automationIds.length === 0) {
    return [] as DriveFileRunRecord[];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("drive_file_runs")
    .select("*")
    .in("automation_id", automationIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DriveFileRunRecord[];
}

export async function listRecentDriveRunsForUser(userId: string, limit = 25) {
  const automations = await listDriveAutomationsForUser(userId);
  return listRecentDriveRunsForAutomationIds(
    automations.map((automation) => automation.id),
    limit,
  );
}

export async function loadAutomationPageData(userId: string): Promise<AutomationPageData> {
  const [pipelines, connections, automations] = await Promise.all([
    listPipelinesForUser(userId),
    listGoogleDriveConnectionsForUser(userId),
    listDriveAutomationsForUser(userId),
  ]);
  const runs = await listRecentDriveRunsForAutomationIds(
    automations.map((automation) => automation.id),
  );

  return { pipelines, connections, automations, runs };
}

export async function getPipelineForUser(userId: string, pipelineId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pipelines")
    .select("id,name,nodes,edges,pipeline_steps,created_at,updated_at")
    .eq("user_id", userId)
    .eq("id", pipelineId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SavedPipelineRecord;
}

export async function getGoogleDriveConnectionForUser(userId: string, connectionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_drive_connections")
    .select("id,user_id,google_account_id,email,encrypted_refresh_token,scopes,created_at,updated_at")
    .eq("user_id", userId)
    .eq("id", connectionId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as GoogleDriveConnectionSecretRecord;
}

export async function getAutomationForUser(userId: string, automationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("drive_automations")
    .select("*")
    .eq("user_id", userId)
    .eq("id", automationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DriveAutomationRecord;
}

export function parsePipelineSteps(value: unknown) {
  return (value as PipelineStep[] | null) ?? [];
}
