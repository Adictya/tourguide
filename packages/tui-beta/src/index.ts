import process from "node:process";

import { Effect } from "effect";

const solidRuntimePluginSupport = "@opentui/solid/runtime-plugin-support";

export const runTui = (explanationPath: string) =>
  Effect.promise(async () => {
    await import(solidRuntimePluginSupport);
    return import("./tui.jsx");
  }).pipe(
    Effect.flatMap((module) => module.runTui(explanationPath)),
  );

const runTuiFromProcess = Effect.gen(function* () {
  const explanationPath = process.argv[2];
  if (!explanationPath) {
    return yield* Effect.fail(new Error("Usage: bun run tui-beta <path/to/file.explanation.json>"));
  }

  yield* runTui(explanationPath);
});

if (import.meta.main) {
  Effect.runPromise(runTuiFromProcess).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
