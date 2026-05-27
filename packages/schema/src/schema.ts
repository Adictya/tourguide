import * as Schema from "@effect/schema/Schema";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const gitSha1Pattern = /^[0-9a-f]{40}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/i;

export const languageIds = [
  "bash",
  "css",
  "diff",
  "html",
  "javascript",
  "json",
  "jsonc",
  "jsx",
  "lua",
  "markdown",
  "python",
  "rust",
  "tsx",
  "typescript",
  "text",
  "yaml",
] as const;

export const defaultDetailLevel = 3;
export const defaultMinDetailLevel = 1;

export const NonEmptyStringSchema = Schema.String.pipe(Schema.minLength(1));

export const PlainTextSchema = NonEmptyStringSchema;

export const MarkdownSchema = NonEmptyStringSchema;

export const UuidSchema = Schema.String.pipe(
  Schema.pattern(uuidPattern, { message: () => "Expected a UUID string" }),
);

export const IsoDateTimeSchema = Schema.String.pipe(
  Schema.pattern(isoDateTimePattern, { message: () => "Expected an ISO 8601 UTC date-time string" }),
);

export const GitSha1Schema = Schema.String.pipe(
  Schema.pattern(gitSha1Pattern, { message: () => "Expected a 40-character Git SHA-1 hash" }),
);

export const Sha256Schema = Schema.String.pipe(
  Schema.pattern(sha256Pattern, { message: () => "Expected a 64-character SHA-256 hash" }),
);

export const DetailLevelSchema = Schema.Literal(1, 2, 3);

export const LanguageIdSchema = Schema.Literal(...languageIds);

export const RepoRelativePosixPathSchema = Schema.String.pipe(
  Schema.filter((path) => isRepoRelativePosixPath(path), {
    message: () => "Expected a repo-relative POSIX path with no absolute path or traversal",
  }),
);

export const PositiveLineNumberSchema = Schema.Number.pipe(
  Schema.filter((line) => Number.isInteger(line) && line >= 1, {
    message: () => "Expected a 1-based line number",
  }),
);

export const NonNegativeIntegerSchema = Schema.Number.pipe(
  Schema.filter((value) => Number.isInteger(value) && value >= 0, {
    message: () => "Expected a non-negative integer",
  }),
);

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

export const StepSchema = Schema.Struct({
  kind: Schema.Literal("step"),
  body: MarkdownSchema,
  anchor: Schema.optional(AnchorSchema),
  minDetailLevel: Schema.optional(DetailLevelSchema),
});

export const FlowSchema = Schema.Struct({
  kind: Schema.Literal("flow"),
  title: PlainTextSchema,
  steps: Schema.Array(StepSchema).pipe(Schema.minItems(2)),
  minDetailLevel: Schema.optional(DetailLevelSchema),
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

export const TourSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  id: UuidSchema,
  title: PlainTextSchema,
  description: NonEmptyStringSchema,
  createdAt: IsoDateTimeSchema,
  topics: Schema.Array(TopicSchema).pipe(Schema.minItems(1)),
  goal: Schema.optional(NonEmptyStringSchema),
  defaultDetailLevel: Schema.optional(DetailLevelSchema),
  repo: Schema.optional(RepoInfoSchema),
});

export type DetailLevel = Schema.Schema.Type<typeof DetailLevelSchema>;
export type LanguageId = Schema.Schema.Type<typeof LanguageIdSchema>;
export type LineRange = Schema.Schema.Type<typeof LineRangeSchema>;
export type Integrity = Schema.Schema.Type<typeof IntegritySchema>;
export type Snapshot = Schema.Schema.Type<typeof SnapshotSchema>;
export type FileRangeAnchor = Schema.Schema.Type<typeof FileRangeAnchorSchema>;
export type DiffHunk = Schema.Schema.Type<typeof DiffHunkSchema>;
export type DiffHunkAnchor = Schema.Schema.Type<typeof DiffHunkAnchorSchema>;
export type EmbeddedExcerptAnchor = Schema.Schema.Type<typeof EmbeddedExcerptAnchorSchema>;
export type Anchor = Schema.Schema.Type<typeof AnchorSchema>;
export type Step = Schema.Schema.Type<typeof StepSchema>;
export type Flow = Schema.Schema.Type<typeof FlowSchema>;
export type TopicItem = Schema.Schema.Type<typeof TopicItemSchema>;
export type Topic = Schema.Schema.Type<typeof TopicSchema>;
export type RepoInfo = Schema.Schema.Type<typeof RepoInfoSchema>;
export type Tour = Schema.Schema.Type<typeof TourSchema>;

export const isLanguageId = (value: string): value is LanguageId =>
  (languageIds as readonly string[]).includes(value);

export const isRepoRelativePosixPath = (path: string): boolean => {
  if (path.length === 0) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("\\")) return false;
  return !path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
};
