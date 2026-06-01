import * as Schema from "@effect/schema/Schema";
import { Effect } from "effect";

import {
  ExplanationJsonParseError,
  ExplanationSchemaError,
  ExplanationSemanticError,
  type ExplanationValidationError,
  type ValidationIssue,
} from "./errors.js";
import { type Anchor, type DiffHunk } from "./anchors.js";
import type { CaptureObservation } from "./capture.js";
import { ExplanationSchema, type Explanation, type Step } from "./explanation.js";
import { isLanguageId } from "./primitives.js";

const decodeExplanation = Schema.decodeUnknown(ExplanationSchema, {
  errors: "all",
  onExcessProperty: "error",
});

export const parseExplanationJson = (json: string): Effect.Effect<Explanation, ExplanationValidationError> =>
  Effect.try({
    try: () => JSON.parse(json) as unknown,
    catch: (cause) =>
      new ExplanationJsonParseError({
        message: cause instanceof Error ? cause.message : "Invalid JSON",
        cause,
      }),
  }).pipe(Effect.flatMap(parseExplanation));

export const parseExplanation = (input: unknown): Effect.Effect<Explanation, ExplanationValidationError> =>
  decodeExplanation(input).pipe(
    Effect.mapError(
      (cause) =>
        new ExplanationSchemaError({
          message: "Explanation does not match the v1 schema",
          cause,
        }),
    ),
    Effect.flatMap(validateExplanationSemantics),
  );

export const validateExplanation = parseExplanation;

const validateExplanationSemantics = (explanation: Explanation): Effect.Effect<Explanation, ExplanationSemanticError> => {
  const issues = collectExplanationIssues(explanation);
  return issues.length > 0 ? Effect.fail(new ExplanationSemanticError({ issues })) : Effect.succeed(explanation);
};

const collectExplanationIssues = (explanation: Explanation): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const slugs = new Map<string, string>();

  for (const [topicIndex, topic] of explanation.topics.entries()) {
    addUniqueSlug(issues, slugs, slugify(topic.title), `$.topics[${topicIndex}].title`, "Topic");

    for (const [itemIndex, item] of topic.items.entries()) {
      const itemPath = `$.topics[${topicIndex}].items[${itemIndex}]`;
      if (item.kind === "flow") addUniqueSlug(issues, slugs, slugify(item.title), `${itemPath}.title`, "Flow");
    }
  }

  for (const [topicIndex, topic] of explanation.topics.entries()) {
    for (const [itemIndex, item] of topic.items.entries()) {
      const itemPath = `$.topics[${topicIndex}].items[${itemIndex}]`;
      if (item.kind === "step") {
        collectStepIssues(issues, item, itemPath, slugs, { insideCapturedFlow: false });
        continue;
      }

      for (const [stepIndex, step] of item.steps.entries()) {
        collectStepIssues(issues, step, `${itemPath}.steps[${stepIndex}]`, slugs, {
          insideCapturedFlow: item.capture !== undefined,
        });
      }
    }
  }

  return issues;
};

const collectStepIssues = (
  issues: ValidationIssue[],
  step: Step,
  stepPath: string,
  slugs: ReadonlyMap<string, string>,
  context: { insideCapturedFlow: boolean },
): void => {
  collectMarkdownIssues(issues, step.body, `${stepPath}.body`, slugs);
  if (step.anchor) collectAnchorIssues(issues, step.anchor, `${stepPath}.anchor`);
  collectObservationIssues(issues, step, stepPath, context);
};

const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

const collectObservationIssues = (
  issues: ValidationIssue[],
  step: Step,
  stepPath: string,
  context: { insideCapturedFlow: boolean },
): void => {
  if (!hasOwn(step, "observation")) return;

  if (!context.insideCapturedFlow) {
    issues.push({ path: `${stepPath}.observation`, message: "Step observations are only valid inside captured Flows" });
  }

  if (step.observation === null || step.observation === undefined) return;

  if (step.anchor?.kind !== "fileRange") {
    issues.push({ path: `${stepPath}.anchor`, message: "Observed Steps require a fileRange Anchor" });
    return;
  }

  collectObservationAnchorIssues(issues, step.observation, step.anchor, stepPath);
};

const collectObservationAnchorIssues = (
  issues: ValidationIssue[],
  observation: CaptureObservation,
  anchor: Extract<Anchor, { kind: "fileRange" }>,
  stepPath: string,
): void => {
  const capturePoint = observation.capturePoint;
  if (!capturePoint) return;

  if (capturePoint.line < anchor.range.startLine || capturePoint.line > anchor.range.endLine) {
    issues.push({
      path: `${stepPath}.observation.capturePoint.line`,
      message: "Observation capturePoint must be inside the Step fileRange Anchor",
    });
  }
};

const collectAnchorIssues = (issues: ValidationIssue[], anchor: Anchor, anchorPath: string): void => {
  if (anchor.kind === "fileRange") {
    if (anchor.source === "workingTree" && anchor.snapshot === undefined) {
      issues.push({ path: `${anchorPath}.snapshot`, message: "workingTree fileRange anchors require a snapshot" });
    }
    if (anchor.source !== undefined && anchor.integrity === undefined) {
      issues.push({ path: `${anchorPath}.integrity`, message: "hydrated fileRange anchors require integrity" });
    }
    return;
  }

  if (anchor.kind === "diffHunk") {
    collectDiffHunkIssues(issues, anchor.hunk, `${anchorPath}.hunk`);
  }
};

const diffHunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

const collectDiffHunkIssues = (issues: ValidationIssue[], hunk: DiffHunk, hunkPath: string): void => {
  const match = diffHunkHeaderPattern.exec(hunk.header);
  if (!match) {
    issues.push({ path: `${hunkPath}.header`, message: "Expected a unified diff hunk header" });
    return;
  }

  const [, oldStart, oldLines = "1", newStart, newLines = "1"] = match;
  compareOptionalNumber(issues, hunk.oldStart, Number(oldStart), `${hunkPath}.oldStart`);
  compareOptionalNumber(issues, hunk.oldLines, Number(oldLines), `${hunkPath}.oldLines`);
  compareOptionalNumber(issues, hunk.newStart, Number(newStart), `${hunkPath}.newStart`);
  compareOptionalNumber(issues, hunk.newLines, Number(newLines), `${hunkPath}.newLines`);
};

const compareOptionalNumber = (
  issues: ValidationIssue[],
  actual: number | undefined,
  expected: number,
  path: string,
): void => {
  if (actual !== undefined && actual !== expected) {
    issues.push({ path, message: `Expected ${expected} to match hunk header` });
  }
};

const addUniqueSlug = (
  issues: ValidationIssue[],
  slugs: Map<string, string>,
  slug: string,
  path: string,
  kind: "Topic" | "Flow",
): void => {
  const existingPath = slugs.get(slug);
  if (existingPath) {
    issues.push({ path, message: `${kind} title slug duplicates ${existingPath}` });
    return;
  }
  slugs.set(slug, path);
};

const collectMarkdownIssues = (
  issues: ValidationIssue[],
  markdown: string,
  path: string,
  slugs: ReadonlyMap<string, string>,
): void => {
  const withoutFences = collectFenceIssues(issues, markdown, path);

  if (/!\[[^\]]*\]\([^)]*\)/.test(withoutFences)) {
    issues.push({ path, message: "Markdown images are not allowed" });
  }

  if (/<[A-Za-z][^>]*>/.test(withoutFences)) {
    issues.push({ path, message: "Raw HTML is not allowed" });
  }

  for (const target of collectInternalLinkTargets(withoutFences)) {
    if (target.kind === "malformed") {
      issues.push({ path, message: `Malformed internal link target: ${target.href}` });
      continue;
    }

    if (!slugs.has(target.slug)) {
      issues.push({ path, message: `Broken internal link target: #${target.slug}` });
    }
  }
};

const fencePattern = /(^|\n)(```|~~~)([^\n]*)\n[\s\S]*?(\n\2)(?=\n|$)/g;

const collectFenceIssues = (issues: ValidationIssue[], markdown: string, path: string): string =>
  markdown.replace(fencePattern, (_match, prefix: string, _fence: string, info: string) => {
    const language = info.trim().split(/\s+/, 1)[0];
    if (language && language !== "mermaid" && !isLanguageId(language)) {
      issues.push({ path, message: `Invalid fenced code language: ${language}` });
    }
    return prefix;
  });

const markdownLinkPattern = /(?<!!)\[[^\]]+\]\((#[^)]+)\)/g;

type InternalLinkTarget =
  | { readonly kind: "slug"; readonly slug: string }
  | { readonly kind: "malformed"; readonly href: string };

const collectInternalLinkTargets = (markdown: string): InternalLinkTarget[] => {
  const targets: InternalLinkTarget[] = [];
  for (const match of markdown.matchAll(markdownLinkPattern)) {
    const href = match[1];
    if (!href) continue;

    const target = decodeInternalLinkTarget(href);
    targets.push(target === undefined ? { kind: "malformed", href } : { kind: "slug", slug: target });
  }
  return targets;
};

const decodeInternalLinkTarget = (href: string): string | undefined => {
  try {
    return decodeURIComponent(href.slice(1).trim());
  } catch {
    return undefined;
  }
};

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "item";
};
