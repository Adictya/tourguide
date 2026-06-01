import * as Schema from "@effect/schema/Schema";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const gitSha1Pattern = /^[0-9a-f]{40}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/i;
const lineBreakPattern = /[\r\n]/;
const markdownLinkPattern = /!?\[[^\]\n]+\]\([^)]+\)/;
const markdownReferenceLinkPattern = /!?\[[^\]\n]+\]\[[^\]\n]*\]/;
const markdownHeadingPattern = /^#{1,6}\s+\S/;
const markdownInlineCodePattern = /`[^`\n]+`/;
const markdownEmphasisPattern = /(^|[\s([{])(?:\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)(?=$|[\s.,;:!?)[\]}])/;
const rawHtmlPattern = /<\/?[A-Za-z][^>\n]*>|<!--/;

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

export const isPlainText = (value: string): boolean => {
  if (lineBreakPattern.test(value)) return false;
  if (markdownLinkPattern.test(value)) return false;
  if (markdownReferenceLinkPattern.test(value)) return false;
  if (markdownHeadingPattern.test(value)) return false;
  if (markdownInlineCodePattern.test(value)) return false;
  if (markdownEmphasisPattern.test(value)) return false;
  return !rawHtmlPattern.test(value);
};

export const PlainTextSchema = NonEmptyStringSchema.pipe(
  Schema.filter((value) => isPlainText(value), {
    message: () => "Expected plain text without Markdown, raw HTML, or line breaks",
  }),
);

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

export const DetailLevelSchema = Schema.Literal(1, 2, 3, 4);

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

export const FiniteNumberSchema = Schema.Number.pipe(
  Schema.filter((value) => Number.isFinite(value), {
    message: () => "Expected a finite number",
  }),
);

export type SanitizedJson =
  | string
  | number
  | boolean
  | null
  | readonly SanitizedJson[]
  | { readonly [key: string]: SanitizedJson };

export const SanitizedJsonSchema: Schema.Schema<SanitizedJson> = Schema.suspend(() =>
  Schema.Union(
    Schema.String,
    FiniteNumberSchema,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(SanitizedJsonSchema),
    Schema.Record({ key: Schema.String, value: SanitizedJsonSchema }),
  ),
);

export type DetailLevel = Schema.Schema.Type<typeof DetailLevelSchema>;
export type LanguageId = Schema.Schema.Type<typeof LanguageIdSchema>;
export type SanitizedJsonValue = Schema.Schema.Type<typeof SanitizedJsonSchema>;

export const isLanguageId = (value: string): value is LanguageId =>
  (languageIds as readonly string[]).includes(value);

export const isRepoRelativePosixPath = (path: string): boolean => {
  if (path.length === 0) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("\\")) return false;
  return !path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
};
