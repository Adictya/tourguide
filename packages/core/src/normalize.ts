import type { Anchor, Tour } from "@tourguide/schema";

import { slugify, uniqueId } from "./ids.js";
import type { NormalizedAnchor, NormalizedStep, NormalizedTopic, NormalizedTour, StepContext } from "./types.js";

const defaultPresentation = { kind: "single" as const };

export function normalizeTour(tour: Tour): NormalizedTour {
  const usedTopicIds = new Set<string>();
  const usedStepIds = new Set<string>();
  const usedAnchorIds = new Set<string>();
  const topics: NormalizedTopic[] = [];
  const steps: NormalizedStep[] = [];

  for (const [topicIndex, topic] of tour.topics.entries()) {
    const topicId = uniqueId(topic.id ?? slugify(topic.title), usedTopicIds);
    const normalizedTopic: NormalizedTopic = {
      id: topicId,
      title: topic.title,
      index: topicIndex,
      stepIds: [],
      ...(topic.body !== undefined ? { body: topic.body } : {})
    };

    for (const [stepIndex, step] of topic.steps.entries()) {
      const stepIdBase = step.id ?? `${topicId}-${slugify(step.title)}`;
      const stepId = uniqueId(stepIdBase, usedStepIds);
      const anchors = normalizeAnchors(step.anchors ?? [], stepId, usedAnchorIds);
      const primaryAnchorId = resolvePrimaryAnchorId(step.primaryAnchorId, anchors);

      const normalizedStep: NormalizedStep = {
        id: stepId,
        title: step.title,
        topicId,
        topicTitle: topic.title,
        topicIndex,
        stepIndex,
        globalIndex: steps.length,
        presentation: step.presentation ?? defaultPresentation,
        anchors,
        ...(step.body !== undefined ? { body: step.body } : {}),
        ...(primaryAnchorId !== undefined ? { primaryAnchorId } : {})
      };

      normalizedTopic.stepIds.push(stepId);
      steps.push(normalizedStep);
    }

    topics.push(normalizedTopic);
  }

  return {
    schemaVersion: tour.schemaVersion,
    id: tour.id,
    title: tour.title,
    topics,
    steps,
    ...(tour.intent !== undefined ? { intent: tour.intent } : {}),
    ...(tour.createdAt !== undefined ? { createdAt: tour.createdAt } : {}),
    ...(tour.generator !== undefined ? { generator: tour.generator } : {}),
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
      ...(tour.intent !== undefined ? { intent: tour.intent } : {})
    },
    step,
    progress: {
      current: step.globalIndex + 1,
      total: tour.steps.length
    }
  };
}

function normalizeAnchors(anchors: Anchor[], stepId: string, usedAnchorIds: Set<string>): NormalizedAnchor[] {
  return anchors.map((anchor, index) => {
    const base = anchor.id ?? `${stepId}-anchor-${index + 1}`;
    const id = uniqueId(base, usedAnchorIds);
    return { ...anchor, id, index };
  });
}

function resolvePrimaryAnchorId(primaryAnchorId: string | undefined, anchors: NormalizedAnchor[]): string | undefined {
  if (anchors.length === 0) return undefined;
  if (primaryAnchorId && anchors.some((anchor) => anchor.id === primaryAnchorId)) return primaryAnchorId;
  return anchors[0]?.id;
}
