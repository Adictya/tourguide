import * as ArrayFormatter from "@effect/schema/ArrayFormatter";
import type * as ParseResult from "@effect/schema/ParseResult";
import { Data, Effect } from "effect";

export type ValidationIssue = {
  path: string;
  message: string;
};

export class TourJsonParseError extends Data.TaggedError("TourJsonParseError")<{
  message: string;
  cause: unknown;
}> {}

export class TourSchemaError extends Data.TaggedError("TourSchemaError")<{
  message: string;
  cause: ParseResult.ParseError;
}> {}

export class TourSemanticError extends Data.TaggedError("TourSemanticError")<{
  issues: readonly ValidationIssue[];
}> {}

export type TourValidationError = TourJsonParseError | TourSchemaError | TourSemanticError;

export const formatTourValidationIssues = (
  error: TourValidationError,
): Effect.Effect<readonly ValidationIssue[]> => {
  switch (error._tag) {
    case "TourJsonParseError":
      return Effect.succeed([{ path: "$", message: error.message }]);
    case "TourSchemaError":
      return ArrayFormatter.formatError(error.cause).pipe(
        Effect.map((issues) =>
          issues.map((issue) => ({
            path: formatPath(issue.path),
            message: issue.message,
          })),
        ),
      );
    case "TourSemanticError":
      return Effect.succeed(error.issues);
  }
};

export const formatTourValidationError = (error: TourValidationError): Effect.Effect<string> =>
  Effect.map(formatTourValidationIssues(error), (issues) =>
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
