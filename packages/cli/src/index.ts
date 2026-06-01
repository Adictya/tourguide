#!/usr/bin/env node
import process from "node:process";

import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { loadExplanation, NodeExplanationFileSystemLive, type LoadExplanationError } from "@elic/core";
import { formatExplanationValidationIssues } from "@elic/schema";
import { Console, Effect } from "effect";

const explanationPath = Args.text({ name: "explanation.json" });

const loadCommand = Command.make("load", { path: explanationPath }, ({ path }) =>
  loadExplanation(path).pipe(
    Effect.provide(NodeExplanationFileSystemLive),
    Effect.flatMap((explanation) =>
      Console.log(JSON.stringify({
        path,
        id: explanation.id,
        title: explanation.title,
        description: explanation.description,
      }, null, 2)),
    ),
    Effect.catchAll((error) =>
      formatLoadExplanationError(error).pipe(
        Effect.flatMap(Console.error),
        Effect.zipRight(Effect.sync(() => {
          process.exitCode = 1;
        })),
      ),
    ),
  ),
).pipe(Command.withDescription("Read and validate an Explanation JSON file"));

const validateCommand = Command.make("validate", { path: explanationPath }, ({ path }) =>
  loadExplanation(path).pipe(
    Effect.provide(NodeExplanationFileSystemLive),
    Effect.flatMap(() => Console.log(`valid: ${path}`)),
    Effect.catchAll((error) =>
      formatLoadExplanationError(error).pipe(
        Effect.flatMap(Console.error),
        Effect.zipRight(Effect.sync(() => {
          process.exitCode = 1;
        })),
      ),
    ),
  ),
).pipe(Command.withDescription("Validate an Explanation JSON file"));

const command = Command.make("elic").pipe(
  Command.withDescription("Open, inspect, and validate ELIC Explanations"),
  Command.withSubcommands([loadCommand, validateCommand]),
);

const cli = Command.run(command, {
  name: "ELIC CLI",
  version: "v0.1.0",
});

const formatLoadExplanationError = (error: LoadExplanationError): Effect.Effect<string> => {
  if (error._tag === "ExplanationFileReadError") {
    return Effect.succeed(`Failed to read ${error.path}: ${formatCause(error.cause)}`);
  }

  return formatExplanationValidationIssues(error).pipe(
    Effect.map((issues) => issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")),
  );
};

const formatCause = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);

Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
);
