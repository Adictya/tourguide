#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

import { normalizeTour, selectStepContext } from "@tourguide/core";
import { assertValidTour, validateTour } from "@tourguide/schema";
import { renderTourViewer } from "@tourguide/tui";

type ParsedArgs = {
  command?: string | undefined;
  tourPath?: string | undefined;
  stepId?: string | undefined;
};

async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  if (!args.command || args.command === "help" || args.command === "--help" || args.command === "-h") {
    printHelp();
    return;
  }

  if (!args.tourPath) {
    throw new Error(`Missing tour path for command: ${args.command}`);
  }

  if (args.command === "validate") {
    const input = await readJson(args.tourPath);
    const result = validateTour(input);
    if (!result.ok) {
      for (const error of result.errors) console.error(`${error.path}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`valid: ${args.tourPath}`);
    return;
  }

  if (args.command === "view") {
    const tour = await loadValidTour(args.tourPath);
    const normalized = normalizeTour(tour);
    console.log(renderTourViewer({ tour: normalized, currentStepId: args.stepId }, { width: process.stdout.columns || 120 }));
    return;
  }

  if (args.command === "context") {
    const tour = await loadValidTour(args.tourPath);
    const normalized = normalizeTour(tour);
    const context = selectStepContext(normalized, args.stepId);
    console.log(JSON.stringify(context, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, tourPath, ...rest] = argv;
  const args: ParsedArgs = { command, tourPath };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--step") {
      args.stepId = rest[index + 1];
      index += 1;
    }
  }

  return args;
}

async function loadValidTour(path: string) {
  const input = await readJson(path);
  assertValidTour(input);
  return input;
}

async function readJson(path: string): Promise<unknown> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content);
}

function printHelp(): void {
  console.log(`TourGuide CLI

Usage:
  tourguide validate <tour.json>
  tourguide view <tour.json> [--step <stepId>]
  tourguide context <tour.json> [--step <stepId>]
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
