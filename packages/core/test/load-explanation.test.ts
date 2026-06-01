import type { Explanation } from "@elic/schema";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { loadExplanation, ExplanationFileReadError, ExplanationFileSystem } from "../src/index.js";

const validExplanation = (): Explanation => ({
  schemaVersion: 1,
  id: "550e8400-e29b-41d4-a716-446655440020",
  title: "Loaded Explanation",
  description: "Verifies loading an Explanation from disk.",
  createdAt: "2026-05-31T12:34:56.000Z",
  topics: [
    {
      title: "Loading",
      items: [
        {
          kind: "step",
          body: "The core package loads strict Explanation JSON.",
        },
      ],
    },
  ],
});

describe("loadExplanation", () => {
  it("reads through the ExplanationFileSystem service and validates Explanation JSON", async () => {
    const fileSystem = Layer.succeed(ExplanationFileSystem, {
      readText: () => Effect.succeed(JSON.stringify(validExplanation())),
    });

    const explanation = await Effect.runPromise(loadExplanation("memory.explanation.json").pipe(Effect.provide(fileSystem)));

    expect(explanation.title).toBe("Loaded Explanation");
  });

  it("fails when the file service cannot read the Explanation", async () => {
    const fileSystem = Layer.succeed(ExplanationFileSystem, {
      readText: (path) => Effect.fail(new ExplanationFileReadError({ path, cause: new Error("missing") })),
    });

    const error = await Effect.runPromise(Effect.flip(loadExplanation("missing.explanation.json").pipe(Effect.provide(fileSystem))));

    expect(error._tag).toBe("ExplanationFileReadError");
  });
});
