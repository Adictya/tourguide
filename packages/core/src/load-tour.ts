import { readFile } from "node:fs/promises";

import { parseTourJson, type Tour, type TourValidationError } from "@tourguide/schema";
import { Context, Data, Effect, Layer } from "effect";

export class TourFileReadError extends Data.TaggedError("TourFileReadError")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export type LoadTourError = TourFileReadError | TourValidationError;

export class TourFileSystem extends Context.Tag("@tourguide/core/TourFileSystem")<TourFileSystem, {
  readonly readText: (path: string) => Effect.Effect<string, TourFileReadError>;
}>() {}

export const NodeTourFileSystemLive = Layer.succeed(TourFileSystem, {
  readText: (path) =>
    Effect.tryPromise({
      try: () => readFile(path, "utf8"),
      catch: (cause) => new TourFileReadError({ path, cause }),
    }),
});

export const loadTour = (path: string): Effect.Effect<Tour, LoadTourError, TourFileSystem> =>
  TourFileSystem.pipe(
    Effect.flatMap((fileSystem) => fileSystem.readText(path)),
    Effect.flatMap(parseTourJson),
  );
