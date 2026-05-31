# Execution Capture Reference

This reference is for TourGuide agents that need runtime evidence to enrich a Tour. It is research/prototype guidance, not a v2 Tour schema.

## Boundary

- An Execution Capture is recorded runtime evidence from an actual program execution.
- Capture orchestration is external to TourGuide core for now.
- A capture skill or external tool may run DAP, OTel, log collection, or another capture mechanism.
- TourGuide may ingest standard outputs from those tools and normalize them into inline Capture Observations on captured Tour Flows.
- TourGuide should not need to own debugger launch details or source instrumentation workflows.
- Do not put debugger commands, breakpoint requests, or expression capture instructions in v1 Tours.

## Current Decisions

- First capture mechanism: Debug Adapter Protocol using `vscode-js-debug` for Node/TypeScript.
- Runtime target: Node first; Bun later.
- Default evidence selection: explicit expressions/variables only.
- Full locals/object expansion is opt-in because debugger scopes can include secrets.
- Captured data should be keyed by source location first: repo-relative path plus line/column/range.
- Final Tour artifacts store normalized Capture Observations inline on captured Flows and Steps.
- Captured Flows may persist `capture.input.path` to native DAP, OTel, or structured-log artifacts so `tourguide validate --hydrate` can refresh inline Observations.
- Missing referenced capture input files are mode-dependent: normal viewing can use inline Observations and lint warnings; hydration fails when it needs the missing input.
- Commit policy is outside TourGuide and the capture skill; users decide whether capture files are committed or shared.
- Final Tour JSON should contain sanitized normalized evidence only, not raw DAP protocol payloads, OTLP payloads, or raw logs.
- Ingestion should be standards-driven where possible. Prefer consuming the native output format of DAP, OTel, structured logs, or other capture tools before inventing TourGuide-specific input formats.
- Normalization should preserve non-sensitive evidence as losslessly as practical. Sensitive values must be replaced with placeholders when the source format marks them sensitive or when user/agent-provided redaction metadata identifies them.

## Current Contract Direction

- Execution Capture is inline Tour evidence, not a reusable standalone TourGuide artifact.
- A captured Flow owns one ordered runtime path.
- The Flow stores `capture.origin` and, for CLI-origin captures, `capture.input.format` plus `capture.input.path`.
- Observed Steps are Steps with an `observation` property. `observation: null` is a hydration placeholder.
- `tourguide validate --hydrate` maps native capture points to observed Steps by order and overwrites inline Observation objects.
- Steps without `observation` inside a captured Flow are explanatory-only.
- Trace-level capture detail uses `minDetailLevel: 4` on Steps, not a separate evidence navigation model.
- A non-null Observation requires a `fileRange` Anchor. The Anchor is the display and semantic range; optional `observation.capturePoint` records the exact runtime line/column.
- Observation evidence is function-centric: call stack, inputs, locals, outputs, and nullable error.
- CLI-origin input formats are `dap-transcript`, `otlp-json-traces`, and `structured-log-jsonl`.
- Authored Observations are allowed only as directly entered evidence and should trigger lint warnings to verify values.

## Proven DAP POC

A throwaway POC was created under `/var/folders/vp/jrfm22z56fz0gd8_wnp569l00000gn/T/opencode/tourguide-dap-poc`.

The POC verified:

- The standalone `vscode-js-debug` DAP server can run outside VS Code from the GitHub release tarball.
- A DAP client can launch a Node program with TypeScript source maps.
- A breakpoint set against `src/sample.ts` resolves to the generated JavaScript.
- The stopped stack frame maps back to the TypeScript source path, line, and column.
- Selected watch expressions can be captured at the breakpoint.
- Local scope variables can be captured and shallow-expanded.
- A raw DAP message transcript can be ingested into rough sanitized normalized evidence.

Important DAP finding:

- `vscode-js-debug` may issue a reverse `startDebugging` request for the real Node target. A non-VS Code DAP client must support this by opening a nested DAP session, or it will see no usable debug thread.
- The next DAP prototype should start from a raw DAP transcript so ingestion is grounded in actual protocol messages before a stable normalized event layer is chosen.
- Useful DAP evidence came from `loadedSource`, `breakpoint`, `stopped`, `stackTrace`, `scopes`, `evaluate`, and `variables` messages.
- The raw transcript is noisy because `loadedSource` events include many skipped Node internals.
- DAP did not mark the sample `secretToken` variable as sensitive. Sensitive handling must come from capture choices, source-format metadata when available, or user/agent-supplied placeholder/redaction metadata.

Safety finding:

- Full local scope capture immediately exposed a `secretToken` field in the sample object. Capture workflows must avoid writing sensitive values into final capture JSON. Prefer explicit expressions and substitute placeholders such as `<redacted-token>` or `<placeholder-secret>` before persisting evidence.

## Prototype Workflow

1. Inspect the Tour or target code and identify source locations worth enriching.
2. Choose explicit expressions to capture at each location.
3. Run the target program under DAP without editing the target source.
4. Set source breakpoints by repo-relative source file and line.
5. Preserve the native capture output needed to understand what the capture mechanism actually produced.
6. Author a captured Flow whose observed Steps correspond to selected capture points in order.
7. Put `observation: null` on Steps that should be hydrated from native capture output.
8. Ingest the native output into sanitized inline Capture Observations with `tourguide validate --hydrate`.
9. Replace sensitive runtime values with placeholders before writing final Tour data; do not rely on commit policy to protect secrets.
10. Preserve `capture.input.path` for future rehydration, but render from inline Observations.

## Ingestion Direction

- Treat DAP, OTel, and structured logging as separate input families that hydrate the same inline Capture Observation shape.
- Do not assume DAP breakpoint data, OTel spans, and logs provide the same fidelity. DAP provides exact debugger stack/values; targeted OTel and targeted logs must provide enough source, stack, and value data to hydrate the common shape.
- Build small ingestors around real outputs first, then harden each input format parser.
- If a source format has a standard way to mark sensitive fields, honor it during normalization.
- If a source format does not mark sensitivity, require the agent/user to provide placeholder values or redaction metadata before final JSON is written.

## Placeholder Policy

- Do not write real secrets, tokens, passwords, cookies, authorization headers, private keys, or customer data into final capture JSON.
- If a sensitive value is conceptually important, preserve its role with a placeholder value.
- Examples: `<redacted-token>`, `<placeholder-user-email>`, `<redacted-cookie>`, `<placeholder-api-key>`.
- Prefer capturing non-sensitive derived values when they explain the runtime behavior just as well.
- If full locals are captured for investigation, review and replace sensitive values before making the artifact readable by TourGuide.
- Do not preserve raw DAP values in the final artifact just for debugging convenience.

## Historical Rough Captured Data Shape

This was early inspection output, not the current contract. Current normalized evidence is inline on captured Flow Steps as Capture Observations:

```json
{
  "runtime": "node",
  "mechanism": "dap:vscode-js-debug",
  "capturedAt": "2026-05-28T00:00:00.000Z",
  "events": [
    {
      "kind": "breakpointHit",
      "location": {
        "path": "src/sample.ts",
        "line": 12,
        "column": 3
      },
      "frame": {
        "name": "computeQuote"
      },
      "expressions": {
        "user.id": "'user_123'",
        "subtotal": "35",
        "total": "28"
      }
    }
  ]
}
```

## Raw DAP Transcript POC

Prototype files were written under `/var/folders/vp/jrfm22z56fz0gd8_wnp569l00000gn/T/opencode/tourguide-dap-poc`:

- `dap-capture-poc.mjs`: launches the standalone `vscode-js-debug` DAP server, drives parent and nested target sessions, sets a TypeScript source breakpoint, captures evidence, and writes a raw DAP transcript.
- `dap-transcript.raw.json`: message-level DAP transcript for the run.
- `ingest-dap-transcript-poc.mjs`: reads the raw transcript and writes a rough sanitized capture artifact.
- `sample.capture.json`: rough output artifact keyed by source location.

Observed legacy POC output shape:

```json
{
  "kind": "executionCapture",
  "sourceFormat": "dap-transcript",
  "sourceAdapter": "vscode-js-debug",
  "events": [
    {
      "kind": "breakpointHit",
      "location": { "path": "src/sample.ts", "line": 12, "column": 3 },
      "frame": { "name": "computeQuote" },
      "expressions": {
        "subtotal": { "type": "number", "value": "35" },
        "total": { "type": "number", "value": "28" }
      }
    }
  ]
}
```

The ingestor placeholder-substituted a sensitive-looking object preview, producing `secretToken: <placeholder-secrettoken>` instead of the raw token-like sample value.

## OTel Trace JSON POC

A repository POC was added under `packages/core` to verify the OTel ingestion path without making the Tour v1 contract depend on OTel.

The POC verified:

- The native capture artifact for OTel should be an OTLP JSON trace export: a JSON-encoded `ExportTraceServiceRequest` with top-level `resourceSpans[]`.
- That artifact can come from an OTel Collector file exporter, an OTLP/HTTP JSON request body, or another exporter that preserves OTLP trace data as protobuf JSON.
- TourGuide should import that native artifact and normalize it into inline Capture Observations before a captured Flow is considered hydrated.
- Stable OTel code semantic attributes can ground evidence: `code.file.path`, `code.line.number`, and `code.column.number`.
- `code.file.path` may be absolute in native OTel output; the ingestor strips a known repo root and writes repo-relative POSIX paths in the normalized artifact.
- Spans or span events without source-location attributes are skipped by default because they are not directly Anchor-ready.
- OTel does not inherently mark common application attributes as sensitive. The POC redacts sensitive-looking keys such as authorization, cookie, email, password, secret, token, API key, and private key before writing final capture JSON.

Prototype files:

- `packages/core/src/otel-capture.ts`: imports OTLP JSON trace exports and emits rough sanitized normalized evidence from the POC.
- `packages/core/test/fixtures/sample.otlp-traces.json`: sample native OTLP JSON trace artifact.
- `packages/core/test/otel-capture.test.ts`: verifies source-location normalization, span/span-event conversion, duration calculation, service/scope preservation, and redaction.

Native OTel artifact shape:

```json
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "quote-service" } }
        ]
      },
      "scopeSpans": [
        {
          "scope": { "name": "tourguide-otel-poc", "version": "0.1.0" },
          "spans": [
            {
              "traceId": "5b8efff798038103d269b633813fc60c",
              "spanId": "1a2b3c4d5e6f7081",
              "name": "computeQuote",
              "kind": 1,
              "attributes": [
                { "key": "code.file.path", "value": { "stringValue": "/workspace/tourguide/src/sample.ts" } },
                { "key": "code.line.number", "value": { "intValue": "12" } },
                { "key": "quote.total", "value": { "intValue": "28" } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Observed legacy POC output shape:

```json
{
  "kind": "executionCapture",
  "sourceFormat": "otlp-json-traces",
  "sourceAdapter": "opentelemetry",
  "capturedAt": "2026-05-30T00:00:00.000Z",
  "summary": {
    "resourceSpansSeen": 1,
    "scopesSeen": 1,
    "spansSeen": 2,
    "spansCaptured": 1,
    "spanEventsSeen": 1,
    "spanEventsCaptured": 1,
    "unlocatedSpansSkipped": 1,
    "unlocatedSpanEventsSkipped": 0
  },
  "events": [
    {
      "kind": "span",
      "location": { "path": "src/sample.ts", "line": 12, "column": 3 },
      "span": {
        "name": "computeQuote",
        "traceId": "5b8efff798038103d269b633813fc60c",
        "spanId": "1a2b3c4d5e6f7081",
        "kind": "internal",
        "serviceName": "quote-service",
        "durationNano": "10000000",
        "statusCode": "ok"
      },
      "attributes": {
        "quote.total": { "type": "int", "value": "28" },
        "customer.email": { "type": "string", "value": "<redacted-customer-email>", "sensitive": true }
      }
    }
  ]
}
```

Important OTel finding:

- OTel traces are good at preserving causal timing and service/scope/span identity, but source grounding is only available when instrumentation records code attributes on spans or span events.
- A root HTTP/server span may explain the request path but is usually not enough for a TourGuide Anchor unless code attributes are attached.
- Span events are a useful capture point for specific source locations inside a broader span. They can carry their own `code.file.path` and `code.line.number` attributes while preserving the parent span identity.
- The native artifact is already JSON when captured as OTLP/HTTP JSON or collector protobuf JSON. The TourGuide-facing evidence should be sanitized inline Capture Observations, not the raw OTLP payload.

## Targeted Structured Log JSONL Direction

The deterministic CLI log parser should not accept arbitrary product logs as if they were complete capture evidence. `structured-log-jsonl` is a targeted input format where each line is one JSON object that can hydrate one Capture Observation.

Each record must provide:

- Source location, using `code.file.path` and `code.line.number` or their normalized equivalents.
- `callStack.frames[]` with at least one frame.
- Optional `values.inputs`, `values.locals`, `values.outputs`, and `values.error` using the captured value shape from the Tour contract.

Existing arbitrary logs may still inform authored evidence, but then the Flow uses `capture.origin: "authored"` and lint warns that values should be verified.

## Open Questions

- Exact parser implementation details for `dap-transcript`, `otlp-json-traces`, and `structured-log-jsonl`.
- Redaction rule format and default sensitive-key patterns.
- How to handle repeated breakpoint hits, sampling, and conditional capture.
- How to represent stale source locations when code changes after capture.
- How much AST assistance should be used to propose Step Anchor ranges from single-line capture points.
