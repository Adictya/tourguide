import { defaultDetailLevel, defaultMinDetailLevel, type Anchor, type DetailLevel, type Step, type Tour } from "@tourguide/schema";

import { slugify, uniqueId } from "./ids.js";
import type { NormalizedAnchor, NormalizedFlow, NormalizedStep, NormalizedTopic, NormalizedTour, StepContext } from "./types.js";

export function normalizeTour(tour: Tour): NormalizedTour {
  const usedTopicIds = new Set<string>();
  const usedFlowIds = new Set<string>();
  const usedAnchorIds = new Set<string>();
  const topics: NormalizedTopic[] = [];
  const flows: NormalizedFlow[] = [];
  const steps: NormalizedStep[] = [];

  for (const [topicIndex, topic] of tour.topics.entries()) {
    const topicId = uniqueId(slugify(topic.title), usedTopicIds);
    const normalizedTopic: NormalizedTopic = {
      id: topicId,
      title: topic.title,
      index: topicIndex,
      stepIds: [],
    };

    let topicStepIndex = 0;
    for (const [itemIndex, item] of topic.items.entries()) {
      if (item.kind === "step") {
        const normalizedStep = normalizeStep({
          step: item,
          topicId,
          topicTitle: topic.title,
          topicIndex,
          itemIndex,
          topicStepIndex,
          globalIndex: steps.length,
          stepId: `${topicId}-step-${topicStepIndex + 1}`,
          minDetailLevel: item.minDetailLevel ?? defaultMinDetailLevel,
          usedAnchorIds,
        });
        normalizedTopic.stepIds.push(normalizedStep.id);
        steps.push(normalizedStep);
        topicStepIndex += 1;
        continue;
      }

      const flowId = uniqueId(slugify(item.title), usedFlowIds);
      const flowMinDetailLevel = item.minDetailLevel ?? defaultMinDetailLevel;
      const normalizedFlow: NormalizedFlow = {
        id: flowId,
        title: item.title,
        topicId,
        topicTitle: topic.title,
        topicIndex,
        itemIndex,
        minDetailLevel: flowMinDetailLevel,
        stepIds: [],
      };

      for (const [flowStepIndex, step] of item.steps.entries()) {
        const normalizedStep = normalizeStep({
          step,
          topicId,
          topicTitle: topic.title,
          topicIndex,
          itemIndex,
          topicStepIndex,
          globalIndex: steps.length,
          stepId: `${flowId}-step-${flowStepIndex + 1}`,
          minDetailLevel: maxDetailLevel(flowMinDetailLevel, step.minDetailLevel ?? defaultMinDetailLevel),
          flowId,
          flowTitle: item.title,
          usedAnchorIds,
        });
        normalizedTopic.stepIds.push(normalizedStep.id);
        normalizedFlow.stepIds.push(normalizedStep.id);
        steps.push(normalizedStep);
        topicStepIndex += 1;
      }

      flows.push(normalizedFlow);
    }

    topics.push(normalizedTopic);
  }

  return {
    schemaVersion: tour.schemaVersion,
    id: tour.id,
    title: tour.title,
    description: tour.description,
    createdAt: tour.createdAt,
    defaultDetailLevel: tour.defaultDetailLevel ?? defaultDetailLevel,
    topics,
    flows,
    steps,
    ...(tour.goal !== undefined ? { goal: tour.goal } : {}),
    ...(tour.repo !== undefined ? { repo: tour.repo } : {})
  };
}

export function selectStepContext(tour: NormalizedTour, stepId?: string): StepContext {
  const step = stepId ? tour.steps.find((candidate) => candidate.id === stepId) : tour.steps[0];
  if (!step) throw new Error(stepId ? `Unknown step: ${stepId}` : "Tour has no steps");

  return {
    tour: {
      id: tour.id,
      title: tour.title,
      description: tour.description,
      ...(tour.goal !== undefined ? { goal: tour.goal } : {})
    },
    step,
    progress: {
      current: step.globalIndex + 1,
      total: tour.steps.length
    }
  };
}

function normalizeStep(input: {
  step: Step;
  topicId: string;
  topicTitle: string;
  topicIndex: number;
  itemIndex: number;
  topicStepIndex: number;
  globalIndex: number;
  stepId: string;
  minDetailLevel: DetailLevel;
  flowId?: string;
  flowTitle?: string;
  usedAnchorIds: Set<string>;
}): NormalizedStep {
  const anchor = input.step.anchor ? normalizeAnchor(input.step.anchor, input.stepId, input.usedAnchorIds) : undefined;

  return {
    id: input.stepId,
    title: deriveStepTitle(input.step.body, input.globalIndex),
    body: input.step.body,
    minDetailLevel: input.minDetailLevel,
    topicId: input.topicId,
    topicTitle: input.topicTitle,
    topicIndex: input.topicIndex,
    itemIndex: input.itemIndex,
    stepIndex: input.topicStepIndex,
    globalIndex: input.globalIndex,
    anchors: anchor ? [anchor] : [],
    ...(anchor ? { anchor, primaryAnchorId: anchor.id } : {}),
    ...(input.flowId !== undefined ? { flowId: input.flowId } : {}),
    ...(input.flowTitle !== undefined ? { flowTitle: input.flowTitle } : {}),
  };
}

function normalizeAnchor(anchor: Anchor, stepId: string, usedAnchorIds: Set<string>): NormalizedAnchor {
  return { ...anchor, id: uniqueId(`${stepId}-anchor`, usedAnchorIds), index: 0 };
}

function maxDetailLevel(first: DetailLevel, second: DetailLevel): DetailLevel {
  return Math.max(first, second) as DetailLevel;
}

function deriveStepTitle(body: string, globalIndex: number): string {
  const text = body
    .split("\n")
    .find((line) => line.trim().length > 0)
    ?.replace(/[`*_#[\]()]/g, "")
    .trim();

  if (!text) return `Step ${globalIndex + 1}`;
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
}
