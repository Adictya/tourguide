#!/usr/bin/env node
import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { normalizeTour, type NormalizedAnchor, type NormalizedStep, type NormalizedTour } from "@tourguide/core";
import {
  formatTourValidationIssues,
  parseTourJson,
  validateTour,
  type DetailLevel,
  type FileRangeAnchor,
  type LanguageId,
  type Tour,
  type ValidationIssue,
} from "@tourguide/schema";
import { Effect } from "effect";

const execFile = promisify(execFileCallback);

type ParsedArgs = {
  command?: string | undefined;
  positionals: string[];
  flags: Map<string, string | true>;
};

class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

const fail = (message: string, exitCode = 1): Effect.Effect<never, CliError> =>
  Effect.fail(new CliError(message, exitCode));

function main(argv: string[]): Effect.Effect<void, CliError> {
  const args = parseArgs(argv);

  if (!args.command) return launchTuiCommand();

  if (args.command === "help" || args.command === "--help" || args.command === "-h") {
    return Effect.sync(printHelp);
  }

  if (hasFlag(args, "help")) return Effect.sync(printHelp);
  if (args.command === "list") return listCommand(args);
  if (args.command === "validate") return validateCommand(args);
  if (args.command === "view") return viewCommand(args);
  if (args.command === "context") return contextCommand(args);
  if (args.command === "strip") return stripCommand(args);

  return fail(`Unknown command: ${args.command}`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const args: ParsedArgs = { command, positionals: [], flags: new Map() };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value) continue;

    if (!value.startsWith("-")) {
      args.positionals.push(value);
      continue;
    }

    if (value === "--") {
      args.positionals.push(...rest.slice(index + 1));
      break;
    }

    if (value === "-h") {
      args.flags.set("help", true);
      continue;
    }

    const [rawName, rawValue] = value.slice(2).split("=", 2);
    if (!rawName) continue;

    if (rawValue !== undefined) {
      args.flags.set(rawName, rawValue);
      continue;
    }

    if (flagRequiresValue(rawName)) {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith("--")) {
        args.flags.set(rawName, "");
        continue;
      }
      args.flags.set(rawName, next);
      index += 1;
      continue;
    }

    args.flags.set(rawName, true);
  }

  return args;
}

function flagRequiresValue(name: string): boolean {
  return name === "step" || name === "detail" || name === "output";
}

function validateCommand(args: ParsedArgs): Effect.Effect<void, CliError> {
  return Effect.gen(function* () {
    const tourPath = yield* requireTourPath(args);
    const hydrate = hasFlag(args, "hydrate");
    const lint = hasFlag(args, "lint");
    const result = yield* loadTourResult(tourPath);
    if (!result.ok) return yield* failIssues(result.issues);

    let tour = result.tour;
    if (hydrate) {
      tour = yield* hydrateTour(tour, tourPath);
      const hydrated = yield* validateTour(tour).pipe(
        Effect.map((validated) => ({ ok: true as const, tour: validated })),
        Effect.catchAll((error) =>
          formatTourValidationIssues(error).pipe(Effect.map((issues) => ({ ok: false as const, issues }))),
        ),
      );
      if (!hydrated.ok) return yield* failIssues(hydrated.issues);
      tour = hydrated.tour;
      yield* writeTourJson(tourPath, tour);
    } else {
      const readinessIssues = yield* collectReadinessIssues(tour);
      if (readinessIssues.length > 0) return yield* failIssues(readinessIssues);
    }

    if (lint) yield* printLintWarnings(tour);
    yield* Effect.sync(() => console.log(`${hydrate ? "hydrated" : "valid"}: ${tourPath}`));
  });
}

function stripCommand(args: ParsedArgs): Effect.Effect<void, CliError> {
  return Effect.gen(function* () {
    const tourPath = yield* requireTourPath(args);
    const result = yield* loadTourResult(tourPath);
    if (!result.ok) return yield* failIssues(result.issues);

    const stripped = stripGeneratedFields(result.tour);
    const output = flagValue(args, "output");
    if (output) {
      yield* writeTourJson(output, stripped);
      yield* Effect.sync(() => console.log(`stripped: ${output}`));
      return;
    }

    if (hasFlag(args, "write")) {
      yield* writeTourJson(tourPath, stripped);
      yield* Effect.sync(() => console.log(`stripped: ${tourPath}`));
      return;
    }

    yield* Effect.sync(() => process.stdout.write(formatJson(stripped)));
  });
}

function viewCommand(args: ParsedArgs): Effect.Effect<void, CliError> {
  return Effect.gen(function* () {
    const tourPath = yield* requireTourPath(args);
    const tour = yield* loadValidTour(tourPath);
    const normalized = normalizeTour(tour);
    const detail = parseDetailLevel(flagValue(args, "detail"), normalized.defaultDetailLevel);
    const view = yield* renderTextView(tour, normalized, flagValue(args, "step"), detail);
    yield* Effect.sync(() => console.log(view));
  });
}

function contextCommand(args: ParsedArgs): Effect.Effect<void, CliError> {
  return Effect.gen(function* () {
    const tourPath = yield* requireTourPath(args);
    const tour = yield* loadValidTour(tourPath);
    const normalized = normalizeTour(tour);
    const detail = parseDetailLevel(flagValue(args, "detail"), normalized.defaultDetailLevel);
    const context = selectStepContextAtDetail(normalized, flagValue(args, "step"), detail);
    yield* Effect.sync(() => console.log(JSON.stringify(context, null, 2)));
  });
}

function listCommand(args: ParsedArgs): Effect.Effect<void, CliError> {
  return Effect.gen(function* () {
    const directory = resolve(process.cwd(), args.positionals[0] ?? ".");
    const files = yield* discoverTourFiles(directory);
    const summaries = yield* Effect.all(files.map((file) => readTourSummary(file)));

    if (hasFlag(args, "json")) {
      yield* Effect.sync(() => console.log(JSON.stringify(summaries, null, 2)));
      return;
    }

    if (summaries.length === 0) {
      yield* Effect.sync(() => console.log("No .tour.json files found"));
      return;
    }

    yield* Effect.sync(() => {
      for (const summary of summaries) {
        const description = summary.description ? ` - ${summary.description}` : "";
        console.log(`${summary.path}\t${summary.title}${description}`);
      }
    });
  });
}

function launchTuiCommand(): Effect.Effect<void, CliError> {
  return Effect.tryPromise({
    try: () => runTuiPackage(),
    catch: (cause) => new CliError(`Failed to launch TUI: ${formatCause(cause)}`),
  });
}

function runTuiPackage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const cwd = fileURLToPath(new URL("../../tui", import.meta.url));
    const bun = process.versions.bun ? process.execPath : "bun";
    const child = spawn(bun, ["run", "./src/index.tsx"], {
      cwd,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(signal ? `TUI exited with signal ${signal}` : `TUI exited with code ${code ?? 1}`));
    });
  });
}

function requireTourPath(args: ParsedArgs): Effect.Effect<string, CliError> {
  const tourPath = args.positionals[0];
  return tourPath ? Effect.succeed(tourPath) : fail(`Missing tour path for command: ${args.command}`);
}

function hasFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.has(name);
}

function flagValue(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function loadValidTour(path: string): Effect.Effect<Tour, CliError> {
  return loadTourResult(path).pipe(
    Effect.flatMap((result) => (result.ok ? Effect.succeed(result.tour) : failIssues(result.issues))),
  );
}

function loadTourResult(path: string): Effect.Effect<
  { ok: true; tour: Tour } | { ok: false; issues: readonly ValidationIssue[] },
  CliError
> {
  return readText(path).pipe(
    Effect.flatMap((content) =>
      parseTourJson(content).pipe(
        Effect.map((tour) => ({ ok: true as const, tour })),
        Effect.catchAll((error) =>
          formatTourValidationIssues(error).pipe(Effect.map((issues) => ({ ok: false as const, issues }))),
        ),
      ),
    ),
  );
}

function readText(path: string): Effect.Effect<string, CliError> {
  return Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => new CliError(`Failed to read ${path}: ${formatCause(cause)}`),
  });
}

function writeTourJson(path: string, tour: Tour): Effect.Effect<void, CliError> {
  return Effect.tryPromise({
    try: () => writeFile(path, formatJson(tour), "utf8"),
    catch: (cause) => new CliError(`Failed to write ${path}: ${formatCause(cause)}`),
  });
}

function formatJson(tour: Tour): string {
  return `${JSON.stringify(tour, null, 2)}\n`;
}

function failIssues(issues: readonly ValidationIssue[]): Effect.Effect<never, CliError> {
  return fail(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
}

function parseDetailLevel(value: string | undefined, fallback: DetailLevel): DetailLevel {
  if (value === undefined) return fallback;
  const detail = Number(value);
  if (detail === 1 || detail === 2 || detail === 3) return detail;
  throw new CliError(`Invalid detail level: ${value}`);
}

function selectStepContextAtDetail(tour: NormalizedTour, stepId: string | undefined, detail: DetailLevel) {
  const steps = tour.steps.filter((step) => step.minDetailLevel <= detail);
  const step = stepId ? steps.find((candidate) => candidate.id === stepId) : steps[0];
  if (!step) throw new CliError(stepId ? `Unknown or excluded step: ${stepId}` : "Tour has no included steps");

  return {
    tour: {
      id: tour.id,
      title: tour.title,
      description: tour.description,
      ...(tour.goal !== undefined ? { goal: tour.goal } : {}),
    },
    detailLevel: detail,
    step,
    progress: {
      current: steps.indexOf(step) + 1,
      total: steps.length,
    },
  };
}

function renderTextView(
  sourceTour: Tour,
  tour: NormalizedTour,
  stepId: string | undefined,
  detail: DetailLevel,
): Effect.Effect<string, CliError> {
  return Effect.gen(function* () {
    const context = selectStepContextAtDetail(tour, stepId, detail);
    const step = context.step as NormalizedStep;
    const anchor = step.anchor ?? step.anchors[0];
    const lines = [
      tour.title,
      tour.description,
      "",
      `${context.progress.current}/${context.progress.total} ${step.title}`,
      step.body,
    ];

    if (anchor) lines.push("", yield* renderAnchor(sourceTour, anchor));
    return lines.join("\n");
  });
}

function renderAnchor(tour: Tour, anchor: NormalizedAnchor): Effect.Effect<string, CliError> {
  if (anchor.kind === "embeddedExcerpt") return Effect.succeed(anchor.content);
  if (anchor.kind === "diffHunk") return Effect.succeed(`${anchor.path}\n${anchor.hunk.header}\n${anchor.hunk.patch}`);
  return resolveFileRange(tour, anchor).pipe(
    Effect.flatMap((resolved) =>
      resolved
        ? Effect.succeed(`${anchor.path}:${anchor.range.startLine}-${anchor.range.endLine}\n${resolved.content}`)
        : fail(`Unable to resolve fileRange anchor: ${anchor.path}`),
    ),
  );
}

type FileRangeRef = {
  path: string;
  anchor: MutableFileRangeAnchor;
};

type SelectedRange = {
  content: string;
  language?: LanguageId;
};

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key];
};

type MutableFileRangeAnchor = Mutable<FileRangeAnchor>;

function hydrateTour(tour: Tour, tourPath: string): Effect.Effect<Tour, CliError> {
  return Effect.tryPromise({
    try: async () => {
      const mutableTour = tour as Mutable<Tour>;
      const refs = collectFileRangeAnchors(tour);
      if (refs.length === 0) return tour;

      const root = await gitRoot(dirname(resolve(tourPath)));
      const commit = tour.repo?.commit ?? (await gitOutput(["rev-parse", "HEAD"], root));
      mutableTour.repo = {
        ...(tour.repo ?? {}),
        vcs: "git",
        commit,
      };

      const issues: ValidationIssue[] = [];
      for (const ref of refs) {
        const workingTree = await readWorkingRange(root, ref.anchor);
        const committed = await readCommitRange(root, commit, ref.anchor);

        if (!workingTree && !committed) {
          issues.push({ path: ref.path, message: `Unable to resolve fileRange anchor: ${ref.anchor.path}` });
          continue;
        }

        const selected = workingTree && committed && workingTree.content === committed.content ? committed : (workingTree ?? committed!);
        ref.anchor.source = selected === committed ? "commit" : "workingTree";
        ref.anchor.integrity = {
          algorithm: "sha256",
          hash: sha256(selected.content),
        };

        if (ref.anchor.source === "workingTree") {
          ref.anchor.snapshot = selected.language
            ? { content: selected.content, language: selected.language }
            : { content: selected.content };
        } else {
          delete ref.anchor.snapshot;
        }
      }

      if (issues.length > 0) throw new CliError(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
      return tour;
    },
    catch: (cause) => (cause instanceof CliError ? cause : new CliError(`Failed to hydrate ${tourPath}: ${formatCause(cause)}`)),
  });
}

function stripGeneratedFields(tour: Tour): Tour {
  for (const ref of collectFileRangeAnchors(tour)) {
    delete ref.anchor.source;
    delete ref.anchor.integrity;
    delete ref.anchor.snapshot;
  }
  return tour;
}

function collectReadinessIssues(tour: Tour): Effect.Effect<ValidationIssue[], CliError> {
  return Effect.tryPromise({
    try: async () => {
      const issues: ValidationIssue[] = [];
      for (const ref of collectFileRangeAnchors(tour)) {
        const resolved = await resolveFileRangeUnsafe(tour, ref.anchor);
        if (!resolved) {
          issues.push({
            path: ref.path,
            message: "fileRange anchor has no resolvable live, commit, or snapshot evidence",
          });
        }
      }
      return issues;
    },
    catch: (cause) => new CliError(`Failed to validate fileRange evidence: ${formatCause(cause)}`),
  });
}

function resolveFileRange(tour: Tour, anchor: FileRangeAnchor): Effect.Effect<SelectedRange | undefined, CliError> {
  return Effect.tryPromise({
    try: () => resolveFileRangeUnsafe(tour, anchor),
    catch: (cause) => new CliError(`Failed to resolve ${anchor.path}: ${formatCause(cause)}`),
  });
}

async function resolveFileRangeUnsafe(tour: Tour, anchor: FileRangeAnchor): Promise<SelectedRange | undefined> {
  const root = await gitRoot(process.cwd()).catch(() => process.cwd());
  const workingTree = await readWorkingRange(root, anchor);
  if (workingTree && anchor.integrity && sha256(workingTree.content) === anchor.integrity.hash) return workingTree;

  if (tour.repo?.commit) {
    const committed = await readCommitRange(root, tour.repo.commit, anchor);
    if (committed) return committed;
  }

  if (anchor.snapshot) {
    return {
      content: anchor.snapshot.content,
      ...(anchor.snapshot.language ? { language: anchor.snapshot.language } : {}),
    };
  }

  return undefined;
}

function collectFileRangeAnchors(tour: Tour): FileRangeRef[] {
  const refs: FileRangeRef[] = [];

  for (const [topicIndex, topic] of tour.topics.entries()) {
    for (const [itemIndex, item] of topic.items.entries()) {
      const itemPath = `$.topics[${topicIndex}].items[${itemIndex}]`;
      if (item.kind === "step") {
        if (item.anchor?.kind === "fileRange") {
          refs.push({ path: `${itemPath}.anchor`, anchor: item.anchor as MutableFileRangeAnchor });
        }
        continue;
      }

      for (const [stepIndex, step] of item.steps.entries()) {
        if (step.anchor?.kind === "fileRange") {
          refs.push({ path: `${itemPath}.steps[${stepIndex}].anchor`, anchor: step.anchor as MutableFileRangeAnchor });
        }
      }
    }
  }

  return refs;
}

async function gitRoot(cwd: string): Promise<string> {
  return gitOutput(["rev-parse", "--show-toplevel"], cwd);
}

async function gitOutput(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  return String(stdout).trim();
}

async function gitFile(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  return String(stdout);
}

async function readCommitRange(root: string, commit: string, anchor: FileRangeAnchor): Promise<SelectedRange | undefined> {
  try {
    const content = await gitFile(["show", `${commit}:${anchor.path}`], root);
    return selectRange(content, anchor);
  } catch {
    return undefined;
  }
}

async function readWorkingRange(root: string, anchor: FileRangeAnchor): Promise<SelectedRange | undefined> {
  try {
    const content = await readFile(resolve(root, anchor.path), "utf8");
    return selectRange(content, anchor);
  } catch {
    return undefined;
  }
}

function selectRange(content: string, anchor: FileRangeAnchor): SelectedRange | undefined {
  const lines = content.split("\n").map((line) => line.replace(/\r$/, ""));
  if (anchor.range.endLine > lines.length) return undefined;
  const selected = lines.slice(anchor.range.startLine - 1, anchor.range.endLine).join("\n");
  const language = inferLanguage(anchor.path);
  return language ? { content: selected, language } : { content: selected };
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function inferLanguage(path: string): LanguageId | undefined {
  switch (extname(path)) {
    case ".bash":
    case ".sh":
      return "bash";
    case ".css":
      return "css";
    case ".html":
      return "html";
    case ".js":
      return "javascript";
    case ".json":
      return "json";
    case ".jsonc":
      return "jsonc";
    case ".jsx":
      return "jsx";
    case ".lua":
      return "lua";
    case ".md":
    case ".mdx":
      return "markdown";
    case ".py":
      return "python";
    case ".rs":
      return "rust";
    case ".tsx":
      return "tsx";
    case ".ts":
      return "typescript";
    case ".yaml":
    case ".yml":
      return "yaml";
    default:
      return undefined;
  }
}

function printLintWarnings(tour: Tour): Effect.Effect<void> {
  return Effect.sync(() => {
    const warnings = collectLintWarnings(tour);
    for (const warning of warnings) console.error(`warning ${warning.path}: ${warning.message}`);
  });
}

function collectLintWarnings(tour: Tour): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  if (!tour.goal) warnings.push({ path: "$.goal", message: "Missing goal; useful for durable Tours that may need revision" });

  let anchorless = 0;
  for (const [topicIndex, topic] of tour.topics.entries()) {
    for (const [itemIndex, item] of topic.items.entries()) {
      if (item.kind === "step") {
        anchorless = item.anchor ? 0 : anchorless + 1;
        if (anchorless === 4) {
          warnings.push({ path: `$.topics[${topicIndex}].items[${itemIndex}]`, message: "More than three consecutive anchorless Steps" });
        }
        continue;
      }

      for (const [stepIndex, step] of item.steps.entries()) {
        anchorless = step.anchor ? 0 : anchorless + 1;
        if (anchorless === 4) {
          warnings.push({ path: `$.topics[${topicIndex}].items[${itemIndex}].steps[${stepIndex}]`, message: "More than three consecutive anchorless Steps" });
        }
      }
    }
  }

  return warnings;
}

type TourSummary = {
  path: string;
  title: string;
  description?: string;
};

function discoverTourFiles(directory: string): Effect.Effect<string[], CliError> {
  return Effect.tryPromise({
    try: async () => {
      const candidates = [join(directory, ".tourguide", "tours"), join(directory, "tours"), directory];
      const seen = new Set<string>();
      const files: string[] = [];
      for (const candidate of candidates) {
        for (const file of await readTourDirectory(candidate)) {
          if (seen.has(file)) continue;
          seen.add(file);
          files.push(file);
        }
      }
      return files;
    },
    catch: (cause) => new CliError(`Failed to discover Tours: ${formatCause(cause)}`),
  });
}

async function readTourDirectory(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".tour.json"))
      .map((entry) => join(directory, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function readTourSummary(path: string): Effect.Effect<TourSummary, CliError> {
  return readText(path).pipe(
    Effect.map((contents) => {
      try {
        const parsed = JSON.parse(contents) as { title?: unknown; description?: unknown; id?: unknown };
        return {
          path: relative(process.cwd(), path),
          title: typeof parsed.title === "string" && parsed.title.length > 0 ? parsed.title : typeof parsed.id === "string" ? parsed.id : basename(path),
          ...(typeof parsed.description === "string" ? { description: parsed.description } : {}),
        };
      } catch {
        return { path: relative(process.cwd(), path), title: basename(path), description: "Invalid JSON" };
      }
    }),
  );
}

function printHelp(): void {
  console.log(`TourGuide CLI

Usage:
  tourguide list [directory] [--json]
  tourguide validate <tour.json> [--hydrate] [--lint]
  tourguide strip <tour.json> [--write | --output <tour.json>]
  tourguide view <tour.json> [--step <stepId>] [--detail 1|2|3]
  tourguide context <tour.json> [--step <stepId>] [--detail 1|2|3]

Run without a command to open the terminal TUI.
`);
}

function formatCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

Effect.runPromise(main(process.argv.slice(2))).catch((error: unknown) => {
  console.error(formatCause(error));
  process.exitCode = error instanceof CliError ? error.exitCode : 1;
});
