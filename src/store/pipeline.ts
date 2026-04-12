import { create } from "zustand";

export type ProcessingStep = "idle" | "uploading" | "processing" | "done" | "error";

export interface PipelineFile {
  id: string;
  file: File;
  name: string;
}

interface PipelineState {
  inputFiles: PipelineFile[];
  instructionFile: PipelineFile | null;
  instructionText: string;
  step: ProcessingStep;
  jobId: string | null;
  resultUrl: string | null;
  error: string | null;

  setInputFiles: (files: PipelineFile[]) => void;
  setInstructionFile: (file: PipelineFile | null) => void;
  setInstructionText: (text: string) => void;
  setStep: (step: ProcessingStep) => void;
  setJobId: (id: string | null) => void;
  setResultUrl: (url: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  inputFiles: [],
  instructionFile: null,
  instructionText: "",
  step: "idle" as ProcessingStep,
  jobId: null,
  resultUrl: null,
  error: null,
};

export const usePipelineStore = create<PipelineState>((set) => ({
  ...initialState,
  setInputFiles: (files) => set({ inputFiles: files }),
  setInstructionFile: (file) => set({ instructionFile: file }),
  setInstructionText: (text) => set({ instructionText: text }),
  setStep: (step) => set({ step }),
  setJobId: (id) => set({ jobId: id }),
  setResultUrl: (url) => set({ resultUrl: url }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
