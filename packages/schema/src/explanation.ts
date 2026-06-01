import * as Schema from "@effect/schema/Schema";

import { AnchorSchema } from "./anchors.js";
import { CaptureObservationSchema, FlowCaptureSchema } from "./capture.js";
import {
  DetailLevelSchema,
  GitSha1Schema,
  IsoDateTimeSchema,
  MarkdownSchema,
  NonEmptyStringSchema,
  PlainTextSchema,
  UuidSchema,
} from "./primitives.js";

export const StepSchema = Schema.Struct({
  kind: Schema.Literal("step"),
  body: MarkdownSchema,
  anchor: Schema.optional(AnchorSchema),
  minDetailLevel: Schema.optional(DetailLevelSchema),
  observation: Schema.optional(Schema.Union(CaptureObservationSchema, Schema.Null)),
});

export const FlowSchema = Schema.Struct({
  kind: Schema.Literal("flow"),
  title: PlainTextSchema,
  steps: Schema.Array(StepSchema).pipe(Schema.minItems(2)),
  minDetailLevel: Schema.optional(DetailLevelSchema),
  capture: Schema.optional(FlowCaptureSchema),
});

export const TopicItemSchema = Schema.Union(StepSchema, FlowSchema);

export const TopicSchema = Schema.Struct({
  title: PlainTextSchema,
  items: Schema.Array(TopicItemSchema).pipe(Schema.minItems(1)),
});

export const RepoInfoSchema = Schema.Struct({
  vcs: Schema.Literal("git"),
  commit: GitSha1Schema,
  rootHint: Schema.optional(Schema.String),
  remoteUrl: Schema.optional(Schema.String),
  baseRef: Schema.optional(Schema.String),
  headRef: Schema.optional(Schema.String),
});

export const ExplanationSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  id: UuidSchema,
  title: PlainTextSchema,
  description: PlainTextSchema,
  createdAt: IsoDateTimeSchema,
  topics: Schema.Array(TopicSchema).pipe(Schema.minItems(1)),
  goal: Schema.optional(NonEmptyStringSchema),
  defaultDetailLevel: Schema.optional(DetailLevelSchema),
  repo: Schema.optional(RepoInfoSchema),
});

export type Step = Schema.Schema.Type<typeof StepSchema>;
export type Flow = Schema.Schema.Type<typeof FlowSchema>;
export type TopicItem = Schema.Schema.Type<typeof TopicItemSchema>;
export type Topic = Schema.Schema.Type<typeof TopicSchema>;
export type RepoInfo = Schema.Schema.Type<typeof RepoInfoSchema>;
export type Explanation = Schema.Schema.Type<typeof ExplanationSchema>;
