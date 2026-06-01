import * as ArrayFormatter from "@effect/schema/ArrayFormatter";
import type * as ParseResult from "@effect/schema/ParseResult";
import { Data, Effect } from "effect";

export type ValidationIssue = {
  path: string;
  message: string;
};

export class ExplanationJsonParseError extends Data.TaggedError("ExplanationJsonParseError")<{
  message: string;
  cause: unknown;
}> {}

export class ExplanationSchemaError extends Data.TaggedError("ExplanationSchemaError")<{
  message: string;
  cause: ParseResult.ParseError;
}> {}

export class ExplanationSemanticError extends Data.TaggedError("ExplanationSemanticError")<{
  issues: readonly ValidationIssue[];
}> {}

export type ExplanationValidationError = ExplanationJsonParseError | ExplanationSchemaError | ExplanationSemanticError;

export const formatExplanationValidationIssues = (
  error: ExplanationValidationError,
): Effect.Effect<readonly ValidationIssue[]> => {
  switch (error._tag) {
    case "ExplanationJsonParseError":
      return Effect.succeed([{ path: "$", message: error.message }]);
    case "ExplanationSchemaError":
      return ArrayFormatter.formatError(error.cause).pipe(
        Effect.map((issues) =>
          issues.map((issue) => ({
            path: formatPath(issue.path),
            message: issue.message,
          })),
        ),
      );
    case "ExplanationSemanticError":
      return Effect.succeed(error.issues);
  }
};

export const formatExplanationValidationError = (error: ExplanationValidationError): Effect.Effect<string> =>
  Effect.map(formatExplanationValidationIssues(error), (issues) =>
    issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
  );

const formatPath = (path: ReadonlyArray<PropertyKey>): string => {
  let formatted = "$";
  for (const key of path) {
    if (typeof key === "number") {
      formatted += `[${key}]`;
      continue;
    }
    const value = String(key);
    formatted += /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? `.${value}` : `[${JSON.stringify(value)}]`;
  }
  return formatted;
};
