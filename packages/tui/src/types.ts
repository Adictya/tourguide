import type { Explanation } from "@elic/schema";

export type ExplanationFile = {
  path: string;
  title: string;
  goal?: string | undefined;
  description?: string | undefined;
};

export type LoadedExplanation = {
  file: ExplanationFile;
  explanation: Explanation;
};
