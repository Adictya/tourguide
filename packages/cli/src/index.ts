#!/usr/bin/env node
import process from "node:process";

import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { loadTour, NodeTourFileSystemLive, type LoadTourError } from "@tourguide/core";
import { formatTourValidationIssues } from "@tourguide/schema";
import { Console, Effect } from "effect";

const tourPath = Args.text({ name: "tour.json" });

const loadCommand = Command.make("load", { path: tourPath }, ({ path }) =>
  loadTour(path).pipe(
    Effect.provide(NodeTourFileSystemLive),
    Effect.flatMap((tour) =>
      Console.log(JSON.stringify({
        path,
        id: tour.id,
        title: tour.title,
        description: tour.description,
      }, null, 2)),
    ),
    Effect.catchAll((error) =>
      formatLoadTourError(error).pipe(
        Effect.flatMap(Console.error),
        Effect.zipRight(Effect.sync(() => {
          process.exitCode = 1;
        })),
      ),
    ),
  ),
).pipe(Command.withDescription("Read and validate a Tour JSON file"));

const command = Command.make("tourguide").pipe(
  Command.withDescription("Open, inspect, and validate TourGuide Tours"),
  Command.withSubcommands([loadCommand]),
);

const cli = Command.run(command, {
  name: "TourGuide CLI",
  version: "v0.1.0",
});

const formatLoadTourError = (error: LoadTourError): Effect.Effect<string> => {
  if (error._tag === "TourFileReadError") {
    return Effect.succeed(`Failed to read ${error.path}: ${formatCause(error.cause)}`);
  }

  return formatTourValidationIssues(error).pipe(
    Effect.map((issues) => issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")),
  );
};

const formatCause = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);

Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
);
