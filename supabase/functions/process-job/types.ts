export type DataShape = "files" | "texts" | "table";

export type StepData =
  | { shape: "files"; paths: string[]; names: string[] }
  | { shape: "texts"; items: { name: string; text: string }[] }
  | { shape: "table"; columns: string[]; rows: Record<string, unknown>[] };

export interface PipelineStep {
  type: "extract-text" | "extract" | "csv-parser" | "merge" | "output" | "validator" | "google-sheets" | "filter" | "email";
  config: {
    prompt?: string;
    templatePath?: string;
    fileType?: string;
    outputFormat?: "csv" | "text";
    /** Output + google-sheets + email steps — identifies which node produced this result in result_paths[]. */
    nodeId?: string;
    /** Output steps only — format for table data. Defaults to xlsx. */
    tableFormat?: "xlsx" | "csv";
    /** Google Sheets steps only */
    sheetId?: string;
    sheetTab?: string;
    /** Validator steps only */
    rules?: unknown[];
    /** Filter steps only */
    filterRules?: unknown[];
    /** Email steps only */
    emailTo?: string;
    emailSubject?: string;
    emailBody?: string;
    emailFormat?: "xlsx" | "csv";
  };
}

export interface Job {
  id: string;
  user_id: string;
  input_paths: string[];
  input_names: string[];
  pipeline_steps: PipelineStep[];
}

export interface StepHandler {
  accepts: DataShape[];
  produces: DataShape;
  /**
   * @param cleanup Mutable set — handlers should add any source-files paths
   *   they create (e.g. temp merged PDFs) so they get deleted after the job.
   */
  run: (input: StepData, config: PipelineStep["config"], cleanup: Set<string>) => Promise<StepData>;
}
