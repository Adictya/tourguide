import { describe, expect, it } from "vitest";

import { normalizeTour, selectStepContext } from "../src/index.js";
import type { Tour } from "@tourguide/schema";

describe("normalizeTour", () => {
  it("derives stable topic, step, and anchor ids", () => {
    const tour: Tour = {
      schemaVersion: 1,
      id: "550e8400-e29b-41d4-a716-446655440010",
      title: "Sample Tour",
      description: "Sample description.",
      createdAt: "2026-05-24T12:34:56.000Z",
      topics: [
        {
          title: "Main Topic",
          items: [
            {
              kind: "step",
              body: "First Step",
              anchor: {
                kind: "fileRange",
                path: "src/index.ts",
                range: { startLine: 1, endLine: 3 }
              }
            }
          ]
        }
      ]
    };

    const normalized = normalizeTour(tour);

    expect(normalized.topics[0]?.id).toBe("main-topic");
    expect(normalized.steps[0]?.id).toBe("main-topic-step-1");
    expect(normalized.steps[0]?.anchors[0]?.id).toBe("main-topic-step-1-anchor");
    expect(normalized.steps[0]?.primaryAnchorId).toBe("main-topic-step-1-anchor");
  });

  it("selects step context by id", () => {
    const normalized = normalizeTour({
      schemaVersion: 1,
      id: "550e8400-e29b-41d4-a716-446655440011",
      title: "Sample Tour",
      description: "Sample description.",
      createdAt: "2026-05-24T12:34:56.000Z",
      topics: [
        {
          title: "Main Topic",
          items: [
            { kind: "step", body: "Intro" },
            { kind: "step", body: "Details" }
          ]
        }
      ]
    });

    const context = selectStepContext(normalized, "main-topic-step-2");

    expect(context.progress).toEqual({ current: 2, total: 2 });
    expect(context.step.title).toBe("Details");
  });
});
