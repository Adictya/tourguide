import { describe, expect, it } from "vitest";

import { normalizeTour, selectStepContext } from "../src/index.js";
import type { Tour } from "@tourguide/schema";

describe("normalizeTour", () => {
  it("derives stable topic, step, and anchor ids", () => {
    const tour: Tour = {
      schemaVersion: 1,
      id: "sample",
      title: "Sample Tour",
      topics: [
        {
          title: "Main Topic",
          steps: [
            {
              title: "First Step",
              anchors: [
                {
                  kind: "fileRange",
                  path: "src/index.ts",
                  range: { startLine: 1, endLine: 3 }
                }
              ]
            }
          ]
        }
      ]
    };

    const normalized = normalizeTour(tour);

    expect(normalized.topics[0]?.id).toBe("main-topic");
    expect(normalized.steps[0]?.id).toBe("main-topic-first-step");
    expect(normalized.steps[0]?.anchors[0]?.id).toBe("main-topic-first-step-anchor-1");
    expect(normalized.steps[0]?.primaryAnchorId).toBe("main-topic-first-step-anchor-1");
  });

  it("selects step context by id", () => {
    const normalized = normalizeTour({
      schemaVersion: 1,
      id: "sample",
      title: "Sample Tour",
      topics: [
        {
          title: "Main Topic",
          steps: [{ id: "intro", title: "Intro" }, { id: "details", title: "Details" }]
        }
      ]
    });

    const context = selectStepContext(normalized, "details");

    expect(context.progress).toEqual({ current: 2, total: 2 });
    expect(context.step.title).toBe("Details");
  });
});
