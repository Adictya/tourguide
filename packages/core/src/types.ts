import type { Anchor, DetailLevel, RepoInfo, Tour } from "@tourguide/schema";

export type NormalizedTour = {
  schemaVersion: Tour["schemaVersion"];
  id: string;
  title: string;
  description: string;
  createdAt: string;
  goal?: string;
  defaultDetailLevel: DetailLevel;
  repo?: RepoInfo;
  topics: NormalizedTopic[];
  flows: NormalizedFlow[];
  steps: NormalizedStep[];
};

export type NormalizedTopic = {
  id: string;
  title: string;
  index: number;
  stepIds: string[];
};

export type NormalizedFlow = {
  id: string;
  title: string;
  topicId: string;
  topicTitle: string;
  topicIndex: number;
  itemIndex: number;
  minDetailLevel: DetailLevel;
  stepIds: string[];
};

export type NormalizedStep = {
  id: string;
  title: string;
  body: string;
  minDetailLevel: DetailLevel;
  topicId: string;
  topicTitle: string;
  topicIndex: number;
  itemIndex: number;
  stepIndex: number;
  globalIndex: number;
  flowId?: string;
  flowTitle?: string;
  primaryAnchorId?: string;
  anchor?: NormalizedAnchor;
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
    description: string;
    goal?: string;
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
