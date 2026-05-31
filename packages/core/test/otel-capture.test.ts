import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { ingestOtlpTraceJson } from "../src/index.js";

describe("ingestOtlpTraceJson", () => {
  it("normalizes a native OTLP JSON trace export into sanitized Execution Capture JSON", async () => {
    const nativeArtifact = await readFile(new URL("./fixtures/sample.otlp-traces.json", import.meta.url), "utf8");

    const capture = ingestOtlpTraceJson(nativeArtifact, {
      capturedAt: "2026-05-30T00:00:00.000Z",
      repoRoot: "/workspace/tourguide",
    });

    expect(capture.kind).toBe("executionCapture");
    expect(capture.sourceFormat).toBe("otlp-json-traces");
    expect(capture.sourceAdapter).toBe("opentelemetry");
    expect(capture.summary).toEqual({
      resourceSpansSeen: 1,
      scopesSeen: 1,
      spansSeen: 2,
      spansCaptured: 1,
      spanEventsSeen: 1,
      spanEventsCaptured: 1,
      unlocatedSpansSkipped: 1,
      unlocatedSpanEventsSkipped: 0,
    });

    const [spanEvent, pointEvent] = capture.events;
    expect(spanEvent).toMatchObject({
      kind: "span",
      location: { path: "src/sample.ts", line: 12, column: 3 },
      span: {
        name: "computeQuote",
        traceId: "5b8efff798038103d269b633813fc60c",
        spanId: "1a2b3c4d5e6f7081",
        parentSpanId: "eee19b7ec3c1b174",
        kind: "internal",
        serviceName: "quote-service",
        durationNano: "10000000",
        statusCode: "ok",
      },
      scope: { name: "tourguide-otel-poc", version: "0.1.0" },
      attributes: {
        "quote.subtotal": { type: "int", value: "35" },
        "quote.total": { type: "int", value: "28" },
        "customer.email": { type: "string", value: "<redacted-customer-email>", sensitive: true },
        "app.secret_token": { type: "string", value: "<redacted-app-secret-token>", sensitive: true },
      },
    });

    expect(pointEvent).toMatchObject({
      kind: "spanEvent",
      location: { path: "src/sample.ts", line: 14 },
      span: { name: "computeQuote" },
      event: { name: "discount.calculated", timeUnixNano: "1716811200010000000" },
      attributes: {
        "quote.discount.percent": { type: "double", value: 0.2 },
      },
    });

    const finalArtifact = JSON.stringify(capture);
    expect(finalArtifact).not.toContain("ada@example.invalid");
    expect(finalArtifact).not.toContain("example-secret-value");
  });
});
