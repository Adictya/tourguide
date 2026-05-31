import type { Tour } from "@tourguide/schema";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { loadTour, TourFileReadError, TourFileSystem } from "../src/index.js";

const validTour = (): Tour => ({
  schemaVersion: 1,
  id: "550e8400-e29b-41d4-a716-446655440020",
  title: "Loaded Tour",
  description: "Verifies loading a Tour from disk.",
  createdAt: "2026-05-31T12:34:56.000Z",
  topics: [
    {
      title: "Loading",
      items: [
        {
          kind: "step",
          body: "The core package loads strict Tour JSON.",
        },
      ],
    },
  ],
});

describe("loadTour", () => {
  it("reads through the TourFileSystem service and validates Tour JSON", async () => {
    const fileSystem = Layer.succeed(TourFileSystem, {
      readText: () => Effect.succeed(JSON.stringify(validTour())),
    });

    const tour = await Effect.runPromise(loadTour("memory.tour.json").pipe(Effect.provide(fileSystem)));

    expect(tour.title).toBe("Loaded Tour");
  });

  it("fails when the file service cannot read the Tour", async () => {
    const fileSystem = Layer.succeed(TourFileSystem, {
      readText: (path) => Effect.fail(new TourFileReadError({ path, cause: new Error("missing") })),
    });

    const error = await Effect.runPromise(Effect.flip(loadTour("missing.tour.json").pipe(Effect.provide(fileSystem))));

    expect(error._tag).toBe("TourFileReadError");
  });
});
