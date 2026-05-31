import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  formatTourValidationIssues,
  parseTour,
  parseTourJson,
  validateTour,
  type Tour,
} from "../src/index.js";

const validTour = (): Tour => ({
  schemaVersion: 1,
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Schema Package Tour",
  description: "Explains the schema package contract.",
  createdAt: "2026-05-24T12:34:56.000Z",
  topics: [
    {
      title: "Package Shape",
      items: [
        {
          kind: "step",
          body: "This introduces the [flow](#schema-flow).",
        },
        {
          kind: "flow",
          title: "Schema Flow",
          steps: [
            {
              kind: "step",
              body: "The first step points at a file range.",
              anchor: {
                kind: "fileRange",
                path: "packages/schema/src/schema.ts",
                range: { startLine: 1, endLine: 12 },
              },
            },
            {
              kind: "step",
              body: "The second step embeds evidence.\n\n```typescript\nconst ok = true;\n```",
              anchor: {
                kind: "embeddedExcerpt",
                content: "const ok = true;",
                language: "typescript",
                startLine: 1,
              },
            },
          ],
        },
      ],
    },
  ],
});

describe("Tour v1 schema", () => {
  it("parses a valid Tour through Effect", async () => {
    const tour = await Effect.runPromise(validateTour(validTour()));

    expect(tour.title).toBe("Schema Package Tour");
  });

  it("parses strict JSON text before schema validation", async () => {
    const tour = await Effect.runPromise(parseTourJson(JSON.stringify(validTour())));

    expect(tour.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects legacy Step titles as excess properties", async () => {
    const input = validTour() as Tour & { topics: Array<{ items: Array<Record<string, unknown>> }> };
    input.topics[0]!.items[0]!.title = "Legacy title";

    const exit = await Effect.runPromiseExit(parseTour(input));

    expect(exit._tag).toBe("Failure");
  });

  it("rejects unsafe repo paths", async () => {
    const input = validTour();
    const item = input.topics[0]!.items[1]!;
    if (item.kind !== "flow") throw new Error("expected flow");
    const anchor = item.steps[0]!.anchor;
    if (anchor?.kind !== "fileRange") throw new Error("expected fileRange");
    anchor.path = "../src/index.ts";

    const exit = await Effect.runPromiseExit(parseTour(input));

    expect(exit._tag).toBe("Failure");
  });

  it("rejects duplicate Topic and Flow slugs", async () => {
    const input = validTour();
    const item = input.topics[0]!.items[1]!;
    if (item.kind !== "flow") throw new Error("expected flow");
    item.title = "Package Shape";

    const error = await Effect.runPromise(Effect.flip(parseTour(input)));
    const issues = await Effect.runPromise(formatTourValidationIssues(error));

    expect(issues.some((issue) => issue.message.includes("duplicates"))).toBe(true);
  });

  it("rejects restricted Markdown", async () => {
    const input = validTour();
    const item = input.topics[0]!.items[0]!;
    if (item.kind !== "step") throw new Error("expected step");
    item.body = "![alt](image.png)\n\n<div>raw</div>\n\n```ts\nconst bad = true;\n```";

    const error = await Effect.runPromise(Effect.flip(parseTour(input)));
    const issues = await Effect.runPromise(formatTourValidationIssues(error));

    expect(issues.some((issue) => issue.message.includes("images"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Raw HTML"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Invalid fenced code language"))).toBe(true);
  });

  it("accepts Trace detail level and captured Flow metadata", async () => {
    const input = validTour();
    input.defaultDetailLevel = 4;
    const item = input.topics[0]!.items[1]!;
    if (item.kind !== "flow") throw new Error("expected flow");
    item.minDetailLevel = 4;
    item.capture = {
      origin: "cli",
      input: {
        format: "structured-log-jsonl",
        path: ".tourguide/captures/signup.raw.jsonl",
      },
    };
    item.steps[0]!.minDetailLevel = 4;
    item.steps[0]!.observation = null;

    const tour = await Effect.runPromise(parseTour(input));

    expect(tour.defaultDetailLevel).toBe(4);
  });

  it("accepts sanitized Capture Observations on captured Flow Steps", async () => {
    const input = validTour();
    const item = input.topics[0]!.items[1]!;
    if (item.kind !== "flow") throw new Error("expected flow");
    item.capture = { origin: "authored" };
    item.steps[0]!.observation = {
      capturePoint: { line: 5, column: 1 },
      callStack: {
        frames: [
          { name: "validateSignup", path: "packages/schema/src/schema.ts", line: 5 },
        ],
      },
      values: {
        inputs: {
          email: { type: "string", value: "<placeholder-user-email>", redacted: true },
        },
        locals: {
          attempts: { type: "number", value: 1 },
        },
        outputs: {
          result: { type: "boolean", value: false },
        },
        error: null,
      },
    };

    const tour = await Effect.runPromise(parseTour(input));

    expect(tour.topics[0]!.items[1]!.kind).toBe("flow");
  });

  it("rejects observations outside captured Flows", async () => {
    const input = validTour();
    const item = input.topics[0]!.items[0]!;
    if (item.kind !== "step") throw new Error("expected step");
    item.observation = null;

    const error = await Effect.runPromise(Effect.flip(parseTour(input)));
    const issues = await Effect.runPromise(formatTourValidationIssues(error));

    expect(issues.some((issue) => issue.message.includes("only valid inside captured Flows"))).toBe(true);
  });

  it("rejects non-null observations without fileRange Anchors", async () => {
    const input = validTour();
    const item = input.topics[0]!.items[1]!;
    if (item.kind !== "flow") throw new Error("expected flow");
    item.capture = { origin: "authored" };
    item.steps[1]!.observation = {
      callStack: { frames: [{ name: "render" }] },
      values: {
        inputs: {},
        locals: {},
        outputs: {},
        error: null,
      },
    };

    const error = await Effect.runPromise(Effect.flip(parseTour(input)));
    const issues = await Effect.runPromise(formatTourValidationIssues(error));

    expect(issues.some((issue) => issue.message.includes("Observed Steps require a fileRange Anchor"))).toBe(true);
  });

  it("rejects capture points outside the Step Anchor", async () => {
    const input = validTour();
    const item = input.topics[0]!.items[1]!;
    if (item.kind !== "flow") throw new Error("expected flow");
    item.capture = { origin: "authored" };
    item.steps[0]!.observation = {
      capturePoint: { line: 99 },
      callStack: { frames: [{ name: "validateSignup" }] },
      values: {
        inputs: {},
        locals: {},
        outputs: {},
        error: null,
      },
    };

    const error = await Effect.runPromise(Effect.flip(parseTour(input)));
    const issues = await Effect.runPromise(formatTourValidationIssues(error));

    expect(issues.some((issue) => issue.message.includes("inside the Step fileRange Anchor"))).toBe(true);
  });
});
