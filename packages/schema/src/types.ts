export type Tour = {
  schemaVersion: 1;
  id: string;
  title: string;
  intent?: string;
  createdAt?: string;
  generator?: GeneratorInfo;
  repo?: RepoInfo;
  topics: Topic[];
};

export type GeneratorInfo = {
  name: string;
  version?: string;
  model?: string;
};

export type RepoInfo = {
  vcs?: "git";
  rootHint?: string;
  remoteUrl?: string;
  commit?: string;
  baseRef?: string;
  headRef?: string;
};

export type Topic = {
  id?: string;
  title: string;
  body?: string;
  steps: Step[];
};

export type Step = {
  id?: string;
  title: string;
  body?: string;
  primaryAnchorId?: string;
  presentation?: Presentation;
  anchors?: Anchor[];
};

export type Presentation = {
  kind: "single" | "flow" | "compare" | "diff";
  preferredDiffView?: "unified" | "sideBySide";
};

export type Anchor = FileRangeAnchor | DiffHunkAnchor | EmbeddedExcerptAnchor;

export type AnchorRole = "primary" | "context" | "before" | "after";

export type BaseAnchor = {
  id?: string;
  note?: string;
  role?: AnchorRole;
};

export type FileRangeAnchor = BaseAnchor & {
  kind: "fileRange";
  path: string;
  range: SourceRange;
  locator?: {
    search?: string;
    symbol?: string;
  };
  integrity?: {
    excerptHash?: string;
    hashAlgorithm?: "sha256";
  };
  snapshot?: {
    language?: string;
    startLine: number;
    content: string;
  };
};

export type SourceRange = {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
};

export type DiffHunkAnchor = BaseAnchor & {
  kind: "diffHunk";
  path: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed";
  hunk: {
    header: string;
    oldStart?: number;
    oldLines?: number;
    newStart?: number;
    newLines?: number;
    patch: string;
  };
  focus?: {
    oldLines?: number[];
    newLines?: number[];
  };
};

export type EmbeddedExcerptAnchor = BaseAnchor & {
  kind: "embeddedExcerpt";
  path?: string;
  language?: string;
  startLine?: number;
  content: string;
  contentHash?: string;
};
