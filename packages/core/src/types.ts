import type { Anchor, Presentation, RepoInfo, Tour } from "@tourguide/schema";

export type NormalizedTour = {
  schemaVersion: Tour["schemaVersion"];
  id: string;
  title: string;
  intent?: string;
  createdAt?: string;
  generator?: Tour["generator"];
  repo?: RepoInfo;
  topics: NormalizedTopic[];
  steps: NormalizedStep[];
};

export type NormalizedTopic = {
  id: string;
  title: string;
  body?: string;
  index: number;
  stepIds: string[];
};

export type NormalizedStep = {
  id: string;
  title: string;
  body?: string;
  topicId: string;
  topicTitle: string;
  topicIndex: number;
  stepIndex: number;
  globalIndex: number;
  primaryAnchorId?: string;
  presentation: Presentation;
  anchors: NormalizedAnchor[];
};

export type NormalizedAnchor = Anchor & {
  id: string;
  index: number;
};

export type StepContext = {
  tour: {
    id: string;
    title: string;
    intent?: string;
  };
  step: NormalizedStep;
  progress: {
    current: number;
    total: number;
  };
};

export type AnchorResolutionStatus = "resolved" | "stale" | "missing" | "snapshotOnly";

export type ResolvedAnchor = {
  anchor: NormalizedAnchor;
  status: AnchorResolutionStatus;
  message?: string;
  content?: string;
};

export type AnchorResolver = {
  resolve(anchor: NormalizedAnchor): Promise<ResolvedAnchor>;
};
