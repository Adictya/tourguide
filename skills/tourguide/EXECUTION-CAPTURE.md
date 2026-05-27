# Execution Capture Reference

This reference is for TourGuide agents that need runtime evidence to enrich a Tour. It is research/prototype guidance, not a v2 Tour schema.

## Boundary

- An Execution Capture is recorded runtime evidence from an actual program execution.
- Capture orchestration is external to TourGuide core for now.
- A capture skill or external tool may run DAP, OTel, log collection, or another capture mechanism.
- TourGuide may ingest standard outputs from those tools and normalize them into completed Execution Capture JSON.
- TourGuide should not need to own debugger launch details or source instrumentation workflows.
- Do not put debugger commands, breakpoint requests, or expression capture instructions in v1 Tours.

## Current Decisions

- First capture mechanism: Debug Adapter Protocol using `vscode-js-debug` for Node/TypeScript.
- Runtime target: Node first; Bun later.
- Default evidence selection: explicit expressions/variables only.
- Full locals/object expansion is opt-in because debugger scopes can include secrets.
- Captured data should be keyed by source location first: repo-relative path plus line/column/range.
- Future Tour artifact references should point only to completed Execution Capture files, not capture instructions.
- Missing referenced capture files are mode-dependent: normal viewing can warn/degrade; strict/export modes may fail.
- Commit policy is outside TourGuide and the capture skill; users decide whether capture files are committed or shared.
- Final capture JSON should contain sanitized normalized evidence only, not raw DAP protocol payloads.
- Ingestion should be standards-driven where possible. Prefer consuming the native output format of DAP, OTel, structured logs, or other capture tools before inventing TourGuide-specific input formats.
- Normalization should preserve non-sensitive evidence as losslessly as practical. Sensitive values may be replaced with placeholders when the source format marks them sensitive or when user/agent-provided redaction metadata identifies them.

## Proven DAP POC

A throwaway POC was created under `/var/folders/vp/jrfm22z56fz0gd8_wnp569l00000gn/T/opencode/tourguide-dap-poc`.

The POC verified:

- The standalone `vscode-js-debug` DAP server can run outside VS Code from the GitHub release tarball.
- A DAP client can launch a Node program with TypeScript source maps.
- A breakpoint set against `src/sample.ts` resolves to the generated JavaScript.
- The stopped stack frame maps back to the TypeScript source path, line, and column.
- Selected watch expressions can be captured at the breakpoint.
- Local scope variables can be captured and shallow-expanded.
- A raw DAP message transcript can be ingested into a rough sanitized Execution Capture JSON file.

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
6. Ingest the native output into a sanitized, normalized Execution Capture artifact.
7. Replace sensitive runtime values with placeholders before writing final captured data; do not rely on commit policy to protect secrets.
8. Write strict JSON as a completed Execution Capture artifact.
9. Reference the completed artifact from future Tour contract work only after the capture data shape stabilizes.

## Ingestion Direction

- Treat DAP, OTel, and structured logging as separate input families until prototypes prove what they can reliably produce.
- Do not assume DAP breakpoint data, OTel spans, and logs share the same evidence model.
- Build small ingestors around real outputs first, then decide the common Execution Capture shape.
- If a source format has a standard way to mark sensitive fields, honor it during normalization.
- If a source format does not mark sensitivity, require the agent/user to provide placeholder values or redaction metadata before final JSON is written.

## Placeholder Policy

- Do not write real secrets, tokens, passwords, cookies, authorization headers, private keys, or customer data into final capture JSON.
- If a sensitive value is conceptually important, preserve its role with a placeholder value.
- Examples: `<redacted-token>`, `<placeholder-user-email>`, `<redacted-cookie>`, `<placeholder-api-key>`.
- Prefer capturing non-sensitive derived values when they explain the runtime behavior just as well.
- If full locals are captured for investigation, review and replace sensitive values before making the artifact readable by TourGuide.
- Do not preserve raw DAP values in the final artifact just for debugging convenience.

## Rough Captured Data Shape

This is inspection output, not a contract:

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

Observed output shape:

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

## Open Questions

- Exact v2 captured data contract.
- How Tour artifacts should reference completed Execution Capture files.
- Redaction rule format and default sensitive-key patterns.
- Whether capture data should include raw DAP values, normalized values, or both.
- Whether locals panel data belongs in the same artifact as selected expressions.
- How to handle repeated breakpoint hits, sampling, and conditional capture.
- How to represent stale source locations when code changes after capture.
