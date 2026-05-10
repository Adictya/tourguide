import { describe, expect, it } from "vitest";

import { validateTour } from "../src/index.js";

describe("validateTour", () => {
  it("accepts a minimal valid tour", () => {
    const result = validateTour({
      schemaVersion: 1,
      id: "minimal",
      title: "Minimal Tour",
      topics: [
        {
          title: "Topic",
          steps: [{ title: "Step" }]
        }
      ]
    });

    expect(result.ok).toBe(true);
  });

  it("rejects extra properties", () => {
    const result = validateTour({
      schemaVersion: 1,
      id: "invalid",
      title: "Invalid Tour",
      extra: true,
      topics: [
        {
          title: "Topic",
          steps: [{ title: "Step" }]
        }
      ]
    });

    expect(result.ok).toBe(false);
  });
});
