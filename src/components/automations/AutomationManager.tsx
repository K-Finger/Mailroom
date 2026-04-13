"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cloud, Play, RefreshCcw, Workflow } from "lucide-react";
import type {
  DriveAutomationRecord,
  DriveFileRunRecord,
  GoogleDriveConnectionRecord,
} from "@/lib/automations/server";
import type { SavedPipelineRecord } from "@/lib/pipeline/workflow";
import { buttonVariants, Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GoogleDriveFolder {
  id: string;
  name: string;
}

interface AutomationManagerProps {
  pipelines: SavedPipelineRecord[];
  connections: GoogleDriveConnectionRecord[];
  automations: DriveAutomationRecord[];
  runs: DriveFileRunRecord[];
  connected?: boolean;
  error?: string | null;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  awaiting_export: "secondary",
  exporting: "secondary",
  queued: "secondary",
  processing: "secondary",
  export_error: "destructive",
  error: "destructive",
};

function describeRunStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function AutomationManager({
  pipelines,
  connections,
  automations,
  runs,
  connected = false,
  error = null,
}: AutomationManagerProps) {
  const router = useRouter();
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    connectionId: connections[0]?.id ?? "",
    pipelineId: pipelines[0]?.id ?? "",
    sourceFolderId: "",
    outputFolderId: "",
    fileNamePattern: "*",
    mimeTypeFilter: "",
    enabled: true,
  });

  const pipelineMap = useMemo(
    () => new Map(pipelines.map((pipeline) => [pipeline.id, pipeline])),
    [pipelines],
  );
  const connectionMap = useMemo(
    () => new Map(connections.map((connection) => [connection.id, connection])),
    [connections],
  );
  const automationMap = useMemo(
    () => new Map(automations.map((automation) => [automation.id, automation])),
    [automations],
  );

  useEffect(() => {
    if (!form.connectionId) {
      setFolders([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadFolders() {
      setLoadingFolders(true);
      try {
        const response = await fetch(`/api/google-drive/folders?connectionId=${form.connectionId}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { folders?: GoogleDriveFolder[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load Google Drive folders");
        }
        if (!cancelled) {
          const nextFolders = payload.folders ?? [];
          setFolders(nextFolders);
          setForm((current) => ({
            ...current,
            sourceFolderId: nextFolders.some((folder) => folder.id === current.sourceFolderId)
              ? current.sourceFolderId
              : "",
            outputFolderId: nextFolders.some((folder) => folder.id === current.outputFolderId)
              ? current.outputFolderId
              : "",
          }));
        }
      } catch (fetchError) {
        if (!cancelled && !(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
          toast.error(fetchError instanceof Error ? fetchError.message : "Failed to load folders");
        }
      } finally {
        if (!cancelled) {
          setLoadingFolders(false);
        }
      }
    }

    void loadFolders();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [form.connectionId]);

  async function submitAutomation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.connectionId || !form.pipelineId || !form.sourceFolderId || !form.outputFolderId) {
      toast.error("Connection, pipeline, source folder, and output folder are required");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: form.connectionId,
          pipelineId: form.pipelineId,
          sourceFolderId: form.sourceFolderId,
          outputFolderId: form.outputFolderId,
          fileNamePattern: form.fileNamePattern,
          mimeTypeFilter: form.mimeTypeFilter,
          enabled: form.enabled,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save automation");
      }
      toast.success("Automation saved");
      router.refresh();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to save automation");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAutomation(automation: DriveAutomationRecord, enabled: boolean) {
    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: automation.id,
          connectionId: automation.connection_id,
          pipelineId: automation.pipeline_id,
          sourceFolderId: automation.source_folder_id,
          outputFolderId: automation.output_folder_id,
          fileNamePattern: automation.file_name_pattern,
          mimeTypeFilter: automation.mime_type_filter,
          enabled,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update automation");
      }
      toast.success(enabled ? "Automation enabled" : "Automation disabled");
      router.refresh();
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : "Failed to update automation");
    }
  }

  async function triggerSync(automationId: string) {
    try {
      setSyncingId(automationId);
      const response = await fetch(`/api/automations/${automationId}/sync`, { method: "POST" });
      const payload = (await response.json()) as {
        scanned?: number;
        created?: number;
        skipped?: number;
        errors?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to sync automation");
      }
      toast.success(`Sync complete: ${payload.created ?? 0} jobs created`);
      router.refresh();
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : "Failed to sync automation");
    } finally {
      setSyncingId(null);
    }
  }

  async function triggerExport(automationId: string) {
    try {
      setExportingId(automationId);
      const response = await fetch(`/api/automations/${automationId}/export`, { method: "POST" });
      const payload = (await response.json()) as {
        exported?: number;
        failed?: number;
        pending?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to export automation results");
      }
      toast.success(`Exported ${payload.exported ?? 0} pending results`);
      router.refresh();
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "Failed to export automation results");
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_color-mix(in_oklch,var(--primary)_8%,transparent),transparent_38%),linear-gradient(180deg,color-mix(in_oklch,var(--background)_94%,white)_0%,var(--background)_100%)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-sm md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Google Drive</p>
            <h1 className="text-2xl font-semibold tracking-tight">Automation control</h1>
            <p className="text-sm text-muted-foreground">
              Connect Drive, pick a saved pipeline, then stage files into the existing Formattr job engine.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/google-drive/oauth/start" className={cn(buttonVariants({ size: "sm" }))}>
              <Cloud className="size-3.5" />
              Connect Google Drive
            </a>
            <Link href="/pipeline" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Workflow className="size-3.5" />
              Back to pipeline
            </Link>
          </div>
        </div>

        {connected && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            Google Drive connected.
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Create automation</CardTitle>
              <CardDescription>
                V1 creates one job per matching Drive file and exports the first pipeline output to a separate destination folder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={submitAutomation}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Google connection</label>
                  <NativeSelect
                    value={form.connectionId}
                    onChange={(event) => setForm((current) => ({ ...current, connectionId: event.target.value }))}
                    disabled={connections.length === 0}
                  >
                    <NativeSelectOption value="" disabled>
                      {connections.length === 0 ? "Connect Google Drive first" : "Select connection"}
                    </NativeSelectOption>
                    {connections.map((connection) => (
                      <NativeSelectOption key={connection.id} value={connection.id}>
                        {connection.email}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Saved pipeline</label>
                  <NativeSelect
                    value={form.pipelineId}
                    onChange={(event) => setForm((current) => ({ ...current, pipelineId: event.target.value }))}
                    disabled={pipelines.length === 0}
                  >
                    <NativeSelectOption value="" disabled>
                      {pipelines.length === 0 ? "Save a pipeline first" : "Select pipeline"}
                    </NativeSelectOption>
                    {pipelines.map((pipeline) => (
                      <NativeSelectOption key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Source folder</label>
                  <NativeSelect
                    value={form.sourceFolderId}
                    onChange={(event) => setForm((current) => ({ ...current, sourceFolderId: event.target.value }))}
                    disabled={!form.connectionId || loadingFolders}
                  >
                    <NativeSelectOption value="" disabled>
                      {loadingFolders ? "Loading folders..." : "Select source folder"}
                    </NativeSelectOption>
                    {folders.map((folder) => (
                      <NativeSelectOption key={folder.id} value={folder.id}>
                        {folder.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Output folder</label>
                  <NativeSelect
                    value={form.outputFolderId}
                    onChange={(event) => setForm((current) => ({ ...current, outputFolderId: event.target.value }))}
                    disabled={!form.connectionId || loadingFolders}
                  >
                    <NativeSelectOption value="" disabled>
                      {loadingFolders ? "Loading folders..." : "Select output folder"}
                    </NativeSelectOption>
                    {folders.map((folder) => (
                      <NativeSelectOption key={folder.id} value={folder.id}>
                        {folder.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Filename pattern</label>
                  <Input
                    value={form.fileNamePattern}
                    onChange={(event) => setForm((current) => ({ ...current, fileNamePattern: event.target.value }))}
                    placeholder="*.pdf"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">MIME filter</label>
                  <Input
                    value={form.mimeTypeFilter}
                    onChange={(event) => setForm((current) => ({ ...current, mimeTypeFilter: event.target.value }))}
                    placeholder="application/pdf,text/csv"
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Enabled</p>
                    <p className="text-xs text-muted-foreground">Manual sync works now. Scheduling can layer on later.</p>
                  </div>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={submitting || connections.length === 0 || pipelines.length === 0}>
                    {submitting ? "Saving..." : "Save automation"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connected accounts</CardTitle>
              <CardDescription>
                Stored refresh tokens are used server-side for sync and export workers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {connections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Google Drive connections yet.</p>
              ) : (
                connections.map((connection) => (
                  <div key={connection.id} className="rounded-xl border border-border bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{connection.email}</p>
                        <p className="text-xs text-muted-foreground">{connection.scopes.join(", ") || "drive"}</p>
                      </div>
                      <Badge variant="outline">Connected</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Automations</CardTitle>
            <CardDescription>
              Use manual sync to stage matching Drive files, then let the existing job worker process them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {automations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No automations configured yet.</p>
            ) : (
              automations.map((automation) => {
                const pipeline = pipelineMap.get(automation.pipeline_id);
                const connection = connectionMap.get(automation.connection_id);
                return (
                  <div key={automation.id} className="rounded-xl border border-border bg-background px-4 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{pipeline?.name ?? "Unknown pipeline"}</p>
                          <Badge variant={automation.enabled ? "default" : "outline"}>
                            {automation.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          {connection && <Badge variant="outline">{connection.email}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Source: {automation.source_folder_id}</span>
                          <span>Output: {automation.output_folder_id}</span>
                        </div>
                        {(automation.file_name_pattern || automation.mime_type_filter.length > 0) && (
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {automation.file_name_pattern && <span>Pattern: {automation.file_name_pattern}</span>}
                            {automation.mime_type_filter.length > 0 && (
                              <span>MIME: {automation.mime_type_filter.join(", ")}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Enabled</span>
                          <Switch
                            checked={automation.enabled}
                            onCheckedChange={(checked) => toggleAutomation(automation, checked)}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerSync(automation.id)}
                          disabled={syncingId === automation.id}
                        >
                          <Play className="size-3.5" />
                          {syncingId === automation.id ? "Syncing..." : "Sync now"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerExport(automation.id)}
                          disabled={exportingId === automation.id}
                        >
                          <RefreshCcw className="size-3.5" />
                          {exportingId === automation.id ? "Exporting..." : "Retry exports"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>
              Drive file revisions are deduped, then tracked through staging, job execution, and export.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Drive file runs yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Automation</TableHead>
                    <TableHead>Source file</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Exported file</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const automation = automationMap.get(run.automation_id);
                    const pipeline = automation ? pipelineMap.get(automation.pipeline_id) : null;
                    return (
                      <TableRow key={run.id}>
                        <TableCell>{pipeline?.name ?? run.automation_id.slice(0, 8)}</TableCell>
                        <TableCell className="max-w-56 truncate">{run.source_file_name ?? run.drive_file_id}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[run.status] ?? "outline"}>
                            {describeRunStatus(run.status)}
                          </Badge>
                          {run.error_message && (
                            <p className="mt-1 max-w-72 text-xs text-destructive">{run.error_message}</p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-56 truncate">{run.exported_drive_file_name ?? "—"}</TableCell>
                        <TableCell>{new Date(run.updated_at).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <p className="text-xs text-muted-foreground">
              Manual sync is implemented. Scheduled polling can call the same worker later.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
