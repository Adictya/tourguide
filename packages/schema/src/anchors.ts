import * as Schema from "@effect/schema/Schema";

import {
  LanguageIdSchema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveLineNumberSchema,
  RepoRelativePosixPathSchema,
  Sha256Schema,
} from "./primitives.js";

export const LineRangeSchema = Schema.Struct({
  startLine: PositiveLineNumberSchema,
  endLine: PositiveLineNumberSchema,
}).pipe(
  Schema.filter((range) => range.startLine <= range.endLine, {
    message: () => "Expected startLine to be less than or equal to endLine",
  }),
);

export const IntegritySchema = Schema.Struct({
  algorithm: Schema.Literal("sha256"),
  hash: Sha256Schema,
});

export const SnapshotSchema = Schema.Struct({
  content: Schema.String,
  language: Schema.optional(LanguageIdSchema),
});

export const FileRangeAnchorSchema = Schema.Struct({
  kind: Schema.Literal("fileRange"),
  path: RepoRelativePosixPathSchema,
  range: LineRangeSchema,
  source: Schema.optional(Schema.Literal("commit", "workingTree")),
  integrity: Schema.optional(IntegritySchema),
  snapshot: Schema.optional(SnapshotSchema),
});

export const DiffHunkSchema = Schema.Struct({
  header: NonEmptyStringSchema,
  patch: Schema.String,
  oldStart: Schema.optional(PositiveLineNumberSchema),
  oldLines: Schema.optional(NonNegativeIntegerSchema),
  newStart: Schema.optional(PositiveLineNumberSchema),
  newLines: Schema.optional(NonNegativeIntegerSchema),
});

export const DiffHunkAnchorSchema = Schema.Struct({
  kind: Schema.Literal("diffHunk"),
  path: RepoRelativePosixPathSchema,
  oldPath: Schema.optional(RepoRelativePosixPathSchema),
  status: Schema.Literal("added", "modified", "deleted", "renamed"),
  hunk: DiffHunkSchema,
});

export const EmbeddedExcerptAnchorSchema = Schema.Struct({
  kind: Schema.Literal("embeddedExcerpt"),
  content: NonEmptyStringSchema,
  path: Schema.optional(RepoRelativePosixPathSchema),
  language: Schema.optional(LanguageIdSchema),
  startLine: Schema.optional(PositiveLineNumberSchema),
});

export const AnchorSchema = Schema.Union(
  FileRangeAnchorSchema,
  DiffHunkAnchorSchema,
  EmbeddedExcerptAnchorSchema,
);

export type LineRange = Schema.Schema.Type<typeof LineRangeSchema>;
export type Integrity = Schema.Schema.Type<typeof IntegritySchema>;
export type Snapshot = Schema.Schema.Type<typeof SnapshotSchema>;
export type FileRangeAnchor = Schema.Schema.Type<typeof FileRangeAnchorSchema>;
export type DiffHunk = Schema.Schema.Type<typeof DiffHunkSchema>;
export type DiffHunkAnchor = Schema.Schema.Type<typeof DiffHunkAnchorSchema>;
export type EmbeddedExcerptAnchor = Schema.Schema.Type<typeof EmbeddedExcerptAnchorSchema>;
export type Anchor = Schema.Schema.Type<typeof AnchorSchema>;
