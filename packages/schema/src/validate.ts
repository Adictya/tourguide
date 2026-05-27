import * as Schema from "@effect/schema/Schema";
import { Effect } from "effect";

import {
  TourJsonParseError,
  TourSchemaError,
  TourSemanticError,
  type TourValidationError,
  type ValidationIssue,
} from "./errors.js";
import { isLanguageId, type Anchor, type DiffHunk, type Step, type Tour, TourSchema } from "./schema.js";

const decodeTour = Schema.decodeUnknown(TourSchema, {
  errors: "all",
  onExcessProperty: "error",
});

export const parseTourJson = (json: string): Effect.Effect<Tour, TourValidationError> =>
  Effect.try({
    try: () => JSON.parse(json) as unknown,
    catch: (cause) =>
      new TourJsonParseError({
        message: cause instanceof Error ? cause.message : "Invalid JSON",
        cause,
      }),
  }).pipe(Effect.flatMap(parseTour));

export const parseTour = (input: unknown): Effect.Effect<Tour, TourValidationError> =>
  decodeTour(input).pipe(
    Effect.mapError(
      (cause) =>
        new TourSchemaError({
          message: "Tour does not match the v1 schema",
          cause,
        }),
    ),
    Effect.flatMap(validateTourSemantics),
  );

export const validateTour = parseTour;

const validateTourSemantics = (tour: Tour): Effect.Effect<Tour, TourSemanticError> => {
  const issues = collectTourIssues(tour);
  return issues.length > 0 ? Effect.fail(new TourSemanticError({ issues })) : Effect.succeed(tour);
};

const collectTourIssues = (tour: Tour): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const slugs = new Map<string, string>();

  for (const [topicIndex, topic] of tour.topics.entries()) {
    addUniqueSlug(issues, slugs, slugify(topic.title), `$.topics[${topicIndex}].title`, "Topic");

    for (const [itemIndex, item] of topic.items.entries()) {
      const itemPath = `$.topics[${topicIndex}].items[${itemIndex}]`;
      if (item.kind === "flow") addUniqueSlug(issues, slugs, slugify(item.title), `${itemPath}.title`, "Flow");
    }
  }

  for (const [topicIndex, topic] of tour.topics.entries()) {
    for (const [itemIndex, item] of topic.items.entries()) {
      const itemPath = `$.topics[${topicIndex}].items[${itemIndex}]`;
      if (item.kind === "step") {
        collectStepIssues(issues, item, itemPath, slugs);
        continue;
      }

      for (const [stepIndex, step] of item.steps.entries()) {
        collectStepIssues(issues, step, `${itemPath}.steps[${stepIndex}]`, slugs);
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
): void => {
  collectMarkdownIssues(issues, step.body, `${stepPath}.body`, slugs);
  if (step.anchor) collectAnchorIssues(issues, step.anchor, `${stepPath}.anchor`);
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
    if (!slugs.has(target)) {
      issues.push({ path, message: `Broken internal link target: #${target}` });
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

const collectInternalLinkTargets = (markdown: string): string[] => {
  const targets: string[] = [];
  for (const match of markdown.matchAll(markdownLinkPattern)) {
    const href = match[1];
    if (href) targets.push(decodeURIComponent(href.slice(1).trim()));
  }
  return targets;
};

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "item";
};
