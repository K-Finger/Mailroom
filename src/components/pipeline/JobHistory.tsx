"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, ExternalLink, Loader2, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface JobResult {
  nodeId: string;
  path: string;
}

interface Job {
  id: string;
  status: "pending" | "processing" | "done" | "error";
  input_names: string[];
  result_paths: JobResult[];
  error_message: string | null;
  created_at: string;
}

interface ResolvedResult {
  nodeId: string;
  path: string;
  url?: string;
  loading?: boolean;
}

function StatusBadge({ status }: { status: Job["status"] }) {
  if (status === "done") return <CheckCircle2 className="size-4 text-green-500 shrink-0" />;
  if (status === "error") return <XCircle className="size-4 text-destructive shrink-0" />;
  return <Loader2 className="size-4 text-muted-foreground shrink-0 animate-spin" />;
}

function ResultRow({ result, jobId }: { result: ResolvedResult; jobId: string }) {
  const supabase = createClient();
  const [url, setUrl] = useState(result.url);
  const [loading, setLoading] = useState(false);

  const isSheets = result.path.startsWith("sheets://");
  const isEmail = result.path === "email://sent";

  const handleDownload = useCallback(async () => {
    if (url) { window.open(url, "_blank"); return; }
    setLoading(true);
    try {
      const { data } = await supabase.storage.from("results").createSignedUrl(result.path, 60 * 60);
      if (data?.signedUrl) {
        setUrl(data.signedUrl);
        window.open(data.signedUrl, "_blank");
      }
    } finally {
      setLoading(false);
    }
  }, [url, result.path, supabase]);

  if (isEmail) {
    return <span className="text-xs text-muted-foreground">Email sent</span>;
  }

  if (isSheets) {
    const spreadsheetId = result.path.slice("sheets://".length);
    const sheetsUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return (
      <a href={sheetsUrl} target="_blank" rel="noreferrer">
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5">
          <ExternalLink className="size-3" />
          Open Sheet
        </Button>
      </a>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2.5 text-xs gap-1.5"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      Download
    </Button>
  );
}

export function JobHistory({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("jobs")
        .select("id, status, input_names, result_paths, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      setJobs((data as Job[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (open) fetchJobs();
  }, [open, fetchJobs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-96 flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b flex-row items-center justify-between">
          <SheetTitle>Run history</SheetTitle>
          <Button variant="ghost" size="icon" className="size-7" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm px-6">
              No runs yet. Run a pipeline manually or set up a Drive watcher.
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="px-6 py-4 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <StatusBadge status={job.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {job.input_names?.[0] ?? "Unknown file"}
                        {job.input_names?.length > 1 && (
                          <span className="text-muted-foreground font-normal"> +{job.input_names.length - 1}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {job.status === "done" && job.result_paths?.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {job.result_paths.map((r) => (
                        <ResultRow key={r.nodeId} result={r} jobId={job.id} />
                      ))}
                    </div>
                  )}

                  {job.status === "error" && job.error_message && (
                    <p className="text-xs text-destructive pl-6 leading-snug">{job.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
