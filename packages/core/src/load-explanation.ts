import { readFile } from "node:fs/promises";

import { parseExplanationJson, type Explanation, type ExplanationValidationError } from "@elic/schema";
import { Context, Data, Effect, Layer } from "effect";

export class ExplanationFileReadError extends Data.TaggedError("ExplanationFileReadError")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export type LoadExplanationError = ExplanationFileReadError | ExplanationValidationError;

export class ExplanationFileSystem extends Context.Tag("@elic/core/ExplanationFileSystem")<ExplanationFileSystem, {
  readonly readText: (path: string) => Effect.Effect<string, ExplanationFileReadError>;
}>() {}

export const NodeExplanationFileSystemLive = Layer.succeed(ExplanationFileSystem, {
  readText: (path) =>
    Effect.tryPromise({
      try: () => readFile(path, "utf8"),
      catch: (cause) => new ExplanationFileReadError({ path, cause }),
    }),
});

export const loadExplanation = (path: string): Effect.Effect<Explanation, LoadExplanationError, ExplanationFileSystem> =>
  ExplanationFileSystem.pipe(
    Effect.flatMap((fileSystem) => fileSystem.readText(path)),
    Effect.flatMap(parseExplanationJson),
  );
