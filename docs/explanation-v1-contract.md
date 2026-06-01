# Explanation v1 Contract Draft

This document captures the current Explanation v1 artifact, authoring, validation, hydration, and Presentation Surface contract. `CONTEXT.md` remains the glossary; this file is the working product/specification contract.

## Status

This is a draft based on accepted domain decisions. Existing schema, core, CLI, and skill implementation may be treated as obsolete unless explicitly carried forward. The current TUI only preserves visual direction, not its data model.

## Core Model

An Explanation is a strict JSON artifact. It is not an Explanation Session, a rendered screen, or a Presentation Surface.

The canonical authored location is `.elic/explanations/<human-slug>.explanation.json`.

CLI commands may accept any explicit path. Default discovery should prefer `.elic/explanations/*.explanation.json`.

Explanation files must use strict JSON, not JSONC, YAML, Lua, or Markdown-only output.

## Top-Level Fields

Required fields:

- `schemaVersion`: numeric artifact schema version. v1 uses `1`.
- `id`: generated stable UUID string for machine/server identity.
- `title`: plain-text title.
- `description`: concise user-facing summary of what the Explanation contains.
- `createdAt`: ISO 8601 date-time for when the Explanation artifact was first created.
- `topics`: non-empty array of Topics.

Optional fields:

- `goal`: LLM-facing maintenance/revision intent. Omit for ephemeral one-off Explanations.
- `defaultDetailLevel`: numeric recommended starting Detail Level. Allowed values are `1`, `2`, `3`, `4`. If omitted, default is `3`.
- `repo`: repository context, required in hydrated output when any `fileRange` Anchor exists.

Removed from v1:

- `intent`; use `goal`.
- `generator`.
- lifecycle fields such as `draft`, `validated`, `hydrated`, or `published`.

## Detail Levels

Detail Levels are additive.

- `1`: Overview.
- `2`: Explore.
- `3`: Deep Dive.
- `4`: Trace.

Explanation content may use `minDetailLevel` on Steps and Flows. If omitted, `minDetailLevel` defaults to `1`.

Rules:

- Higher Detail Levels include lower-level content.
- There is no `maxDetailLevel`.
- Topics do not have `minDetailLevel`.
- Anchors do not have `minDetailLevel`.
- Trace is for low-level ordered Capture Observations inside captured Flows. Trace is not another name for an Execution Capture artifact or an OTel trace.
- An Explanation Session owns the active Detail Level.
- Changing active Detail Level never mutates the Explanation artifact.
- Topic navigation skips Topics with no included Steps after Detail Level filtering.
- If a Flow has fewer than two included Steps after filtering, its grouping dissolves for that Explanation Session. One remaining Step is presented as a normal Step; zero remaining Steps are skipped.

## Structure

An Explanation contains Topics. A Topic contains an ordered mixed list of standalone Steps and Flows. A Flow contains ordered Steps only.

### Topic

Required fields:

- `title`: non-empty plain text.
- `items`: non-empty ordered array of `step` or `flow` items.

Topic rules:

- No Topic `body`.
- Topic titles are the higher-order navigation labels.
- Topic title slugs must be globally unique in the Explanation for internal links.

### Flow

Required fields:

- `kind`: `flow`.
- `title`: non-empty plain text.
- `steps`: at least two Steps.

Optional fields:

- `minDetailLevel`: `1`, `2`, `3`, or `4`; default `1`.
- `capture`: captured Flow metadata when the Flow presents one ordered runtime path.

Flow rules:

- No Flow `body`.
- No nested Flows.
- Flow title slugs must be globally unique in the Explanation for internal links.
- Step remains the unit of next/previous navigation.
- Flow is not a formal higher-order navigation target.
- Flow presentation requires adjacent Step relationships to be visible together, but not necessarily every Step in the Flow at once.
- Branching call graphs should be represented as multiple linear Flows, with repeated Anchor targets when a callsite is revisited for a different branch.
- A Flow with `capture` contains ordered Steps for a captured runtime path. Steps with an `observation` property consume raw capture points in order during hydration; Steps without `observation` are non-observed Steps.
- Low-level capture points that are not part of the main path should remain in the Flow as Trace-level Steps using `minDetailLevel: 4`, not be omitted from the captured path.

### Flow Capture

Flow `capture` is inline Explanation evidence metadata, not a separate artifact reference.

Allowed shapes:

```json
{
  "origin": "cli",
  "input": {
    "format": "dap-transcript",
    "path": ".elic/captures/signup.raw.json"
  }
}
```

```json
{
  "origin": "authored"
}
```

Fields:

- `origin`: required. Allowed values are `cli` and `authored`.
- `input`: required when `origin` is `cli`; invalid when `origin` is `authored`.
- `input.format`: required for CLI-origin capture. Allowed values are `dap-transcript`, `otlp-json-traces`, and `structured-log-jsonl`.
- `input.path`: required for CLI-origin capture. It is a repo-relative POSIX path to the native capture artifact used for rehydration.

Capture rules:

- `origin: "cli"` means inline Observations are generated or refreshed by `elic validate --hydrate` from `capture.input`.
- `origin: "authored"` means inline Observations were added directly by an LLM or author. Lint warns because values should be verified.
- `capture.input.path` persists after hydration so capture evidence can be refreshed later.
- Presentation Surfaces must render from inline Observations and must not require `capture.input.path` to exist.
- `capture.input.path` is required only for rehydration. Missing input files fail `validate --hydrate` and produce lint warnings during normal validation.

### Step

Required fields:

- `kind`: `step`.
- `body`: non-empty Markdown Step body.

Optional fields:

- `anchor`: one Anchor.
- `minDetailLevel`: `1`, `2`, `3`, or `4`; default `1`.
- `observation`: `null` hydration placeholder or one Capture Observation. Only valid on Steps inside a Flow with `capture`.

Step rules:

- No Step `title`.
- No Step `presentation`.
- No `anchors` array.
- No `primaryAnchorId`.
- A Step may be anchorless for conceptual framing, transitions, or summaries.
- A concrete claim about code should normally have an Anchor.
- The same Anchor target may appear in multiple Steps when the same evidence supports different conceptual moves.
- A Step with an `observation` property is an observed Step. `observation: null` marks a draft hydration placeholder.
- `elic validate --hydrate` overwrites existing Observation objects and fills `null` placeholders by raw capture point order.
- Final readiness validation rejects remaining `observation: null` values.
- A Step with a non-null Observation must have a `fileRange` Anchor. The Anchor is the display and semantic source range for the Observation.
- A Trace-level captured Step still requires `body`, but the body may be terse generated prose because the Observation carries the low-level runtime evidence.

### Capture Observation

A Capture Observation is structured runtime evidence on one Step inside a captured Flow.

Shape:

```json
{
  "capturePoint": { "line": 12, "column": 5 },
  "callStack": {
    "frames": [
      { "name": "validateSignup", "path": "src/signup.ts", "line": 12 },
      { "name": "handleSignup", "path": "src/routes/signup.ts", "line": 33 }
    ]
  },
  "values": {
    "inputs": {
      "email": { "type": "string", "value": "abc@gmail.com" }
    },
    "locals": {
      "normalizedEmail": { "type": "string", "value": "abc@gmail.com" }
    },
    "outputs": {
      "result": { "type": "boolean", "value": false }
    },
    "error": null
  }
}
```

Observation fields:

- `capturePoint`: optional exact runtime point inside the Step Anchor. `line` is 1-based. `column` is optional and 1-based when present.
- `callStack`: required.
- `callStack.frames`: non-empty array. The first frame is the current observed function or execution point.
- `frame.name`: required.
- `frame.path`, `frame.line`, and `frame.column`: optional source metadata.
- `values`: required.
- `values.inputs`, `values.locals`, and `values.outputs`: required maps keyed by variable, expression, or semantic value name.
- `values.error`: required; either `null` or an Error Observation object.

Observation rules:

- Observation has no separate title, summary, or Markdown body. Explanation belongs in the Step body.
- Observation does not duplicate the Step Anchor range. The Step Anchor is the source range.
- `capturePoint` records the exact breakpoint/log/span point when the raw capture provides one.
- The current function name is derived from `callStack.frames[0].name`; there is no separate `function` field.
- Capture method details do not appear on the Observation. They are represented by Flow `capture.origin` and `capture.input.format`.

Captured value shape:

```json
{ "type": "string", "value": "abc@gmail.com" }
```

Allowed `type` values are `string`, `number`, `boolean`, `null`, `array`, `object`, and `unknown`.

Value rules:

- `value` must be sanitized JSON suitable for display.
- Sensitive values must be replaced with placeholders and marked with `redacted: true`.
- Raw secrets, tokens, passwords, cookies, authorization headers, private keys, and customer data must not appear in final Explanation JSON.

Error Observation shape:

```json
{
  "name": "ValidationError",
  "message": "Domain is not allowed",
  "value": { "type": "string", "value": "domain_not_allowed" },
  "stack": [{ "name": "validateSignup", "path": "src/signup.ts", "line": 22 }]
}
```

Error rules:

- `message` is required when `values.error` is not `null`.
- `name`, `value`, and `stack` are optional.
- `stack` uses the same frame shape as `callStack.frames`.

## Anchors

A Step has zero or one Anchor. An Anchor identifies grounded evidence; prose belongs in the Step body.

Removed from v1 Anchors:

- Anchor IDs.
- Anchor notes.
- Anchor roles such as `primary`, `context`, `before`, or `after`.
- `locator.search` and `locator.symbol`.

v1 Anchor kinds:

- `fileRange`.
- `diffHunk`.
- `embeddedExcerpt`.

## fileRange Anchor

Authored fields:

- `kind`: `fileRange`.
- `path`: repo-relative POSIX path.
- `range`: line range.

Generated hydrated fields:

- `source`: `commit` or `workingTree`.
- `integrity`: hash metadata for the selected evidence.
- `snapshot`: generated fallback content when required.

Path rules:

- Paths are relative to the repository root.
- Absolute paths are invalid.
- `..` traversal is invalid.
- Use `/` separators.

Range rules:

- `startLine` and `endLine` are 1-based inclusive line numbers.
- `startLine` must be less than or equal to `endLine`.
- v1 does not support columns.

Source rules:

- `source` is generated by hydration, not authored by the LLM.
- `commit` means the evidence is tied to `repo.commit`.
- `workingTree` means the evidence is tied to uncommitted live working tree content.
- `workingTree` file ranges require a generated `snapshot`.
- `fileRange.snapshot` is always generated. Authors should use `embeddedExcerpt` for authored embedded evidence.

Integrity rules:

- Hydrated `fileRange` Anchors must have `integrity`.
- `integrity` uses `sha256` over the selected evidence content.
- Integrity lets tools decide whether live working tree content still matches the authored evidence.

Snapshot rules:

- Snapshots are fallback display content.
- Snapshots are generated by tooling.
- Snapshots have no separate hash.
- Commit-backed file ranges do not get snapshots by default.
- Working-tree file ranges get snapshots by default.
- Export or portable modes may generate snapshots for all file ranges.

fileRange is for existing repo files. Deleted historical files should be modeled with `diffHunk` or `embeddedExcerpt` in v1.

## diffHunk Anchor

Required fields:

- `kind`: `diffHunk`.
- `path`: repo-relative POSIX path.
- `status`: `added`, `modified`, `deleted`, or `renamed`.
- `hunk.header`: hunk header.
- `hunk.patch`: hunk body without the header line.

Optional fields:

- `oldPath`: previous path for renamed or deleted files.
- `hunk.oldStart`.
- `hunk.oldLines`.
- `hunk.newStart`.
- `hunk.newLines`.

diffHunk rules:

- Diff display mode is a Presentation Surface or user preference, not Explanation data.
- No `language`; diff is implied by the Anchor kind.
- No `focus`; use a smaller hunk or another Step.
- Hunk line metadata is optional, but if present it must validate against the header.
- `diffHunk` does not require `repo` because the patch embeds its own evidence.

## embeddedExcerpt Anchor

Required fields:

- `kind`: `embeddedExcerpt`.
- `content`: selected evidence text.

Optional fields:

- `path`: source metadata, validated as repo-relative POSIX path when present.
- `language`: canonical language ID.
- `startLine`: 1-based starting line number.

embeddedExcerpt rules:

- It is authored primary evidence, not generated fallback data.
- It is appropriate for non-repo evidence or portable selected evidence.
- Do not embed whole files by default.
- No `contentHash` in v1.
- `startLine` does not require `path`.

## Repository Context

If `repo` exists, v1 requires:

- `vcs`: `git`.
- `commit`: full 40-character Git SHA-1 hash.

Optional repo fields:

- `rootHint`: human-readable hint for where the Explanation expects to be opened.
- `remoteUrl`: optional remote identity; do not require it because it may be absent or sensitive.
- `baseRef`: optional revision context for PR or implementation-summary Explanations.
- `headRef`: optional revision context for PR or implementation-summary Explanations.

Hydration rules:

- Authored Explanations may omit `repo`.
- If any `fileRange` Anchor exists, hydrated output has `repo.vcs` and `repo.commit`.
- If `repo.commit` is missing, hydration sets it to the current Git `HEAD`.
- If `repo.commit` already exists, default hydration does not silently rebase the Explanation to a new commit.

## Markdown

Step bodies are Markdown.

Allowed:

- Paragraphs.
- Headings.
- Lists.
- Emphasis.
- Inline code.
- Fenced code blocks.
- Links.
- Mermaid fenced code blocks.

Disallowed:

- Raw HTML.
- Image syntax.
- Embedded scripts or custom components.

Mermaid rules:

- Mermaid is allowed only as a fenced code block.
- Surfaces that cannot render Mermaid must show the Mermaid source as code.

Link rules:

- External Markdown links are allowed.
- Internal links may target Topics and Flows.
- Internal links do not target Steps in v1 because Steps have no titles or IDs.
- Topic links use derived `topic` slugs.
- Flow links use derived `flow` slugs.
- Topic and Flow slugs must be globally unique in the Explanation.
- Validation must reject broken internal Topic/Flow links.

## Language IDs

Language IDs are canonical enum values. Aliases such as `js`, `ts`, `sh`, and `md` are invalid.

Allowed v1 language IDs:

- `bash`.
- `css`.
- `diff`.
- `html`.
- `javascript`.
- `json`.
- `jsonc`.
- `jsx`.
- `lua`.
- `markdown`.
- `python`.
- `rust`.
- `tsx`.
- `typescript`.
- `text`.
- `yaml`.

These IDs apply to embedded excerpts, generated snapshots, and fenced code block language tags when a language is specified.

## Authored and Hydrated Shapes

Authored and hydrated Explanations are both Explanations. They are not separate domain concepts and no lifecycle state is embedded in the artifact.

Authored shape:

- Minimal LLM/user output.
- Includes semantic structure, Step bodies, and Anchor targets.
- Does not include `fileRange.source`.
- Does not include `fileRange.integrity`.
- Does not include `fileRange.snapshot`.
- May omit `repo` when tooling can infer it.
- May include captured Flow `capture` metadata and `observation: null` placeholders before capture hydration.
- May include authored Observations when capture evidence was entered directly rather than hydrated from a CLI-readable input.

Hydrated shape:

- Ready for validation and viewing.
- Includes generated repo context when needed.
- Includes generated `fileRange.source`.
- Includes generated `fileRange.integrity`.
- Includes generated `fileRange.snapshot` for working-tree file ranges or explicit portable export.
- Includes hydrated Observation objects for observed Steps in CLI-origin captured Flows.

Generated fields remain inline on Anchors. They are not grouped under a `generated` object.

## Validation and Hydration

`elic validate <explanation>` is read-only and means the Explanation can be presented correctly on the current machine.

Validation behavior:

- Always validate JSON structure.
- Always validate Markdown restrictions.
- Always validate internal links.
- Validate only external dependencies the Explanation actually uses.
- If no `fileRange` Anchors exist, Git validation is not required.
- `diffHunk` and `embeddedExcerpt` Anchors can validate without Git because they embed their evidence.
- `fileRange` Anchors require enough available evidence to present correctly.

fileRange presentation resolution order:

- Prefer live working tree content only when integrity exists and matches.
- Otherwise use `repo.commit` content when available.
- Otherwise use generated `snapshot` when available.
- Otherwise validation/view fails.

`elic validate --hydrate <explanation>` is mutating.

Hydration behavior:

- Performs structural validation first.
- Hydrates capture Observations for captured Flows with `capture.origin: "cli"` before fileRange Anchor hydration.
- Reads each `capture.input.path` according to `capture.input.format`.
- Maps raw capture points to observed Steps by order. Observed Steps are Steps with an `observation` property, whether the value is `null` or an existing Observation object.
- Overwrites existing Observation objects during rehydration.
- Leaves Steps without an `observation` property unchanged as non-observed Steps.
- Fails `validate --hydrate` when the raw capture point count does not match the observed Step count for a captured Flow.
- Fills generated repo context when needed.
- Infers and writes `fileRange.source` per Anchor.
- Regenerates `fileRange.integrity`.
- Generates snapshots for `workingTree` file ranges.
- Does not generate snapshots for commit-backed file ranges by default.
- Can switch generated `source` between `commit` and `workingTree` when the current evidence state changes.
- Can remove generated snapshots when they are no longer required, unless snapshot/export mode requested them.
- Can remove stale generated fileRange fields when an Anchor is no longer a `fileRange`.
- Does not rewrite authored fields such as title, description, goal, Topic/Flow titles, Step bodies, paths, ranges, ordering, `capture.origin`, or `capture.input`.

Capture input requirements:

- `dap-transcript` input must provide selected capture points with source location, stopped stack frames, and targeted values from debugger evaluation or variables data. Full locals are not required and should remain opt-in.
- `otlp-json-traces` input must be OTLP JSON trace data with top-level `resourceSpans[]`. Hydrated spans or span events must provide `code.file.path` and `code.line.number`. Targeted values must use role prefixes such as `elic.input.email`, `elic.local.normalizedEmail`, and `elic.output.result`. Parent span chains may be synthesized into `callStack.frames`.
- `structured-log-jsonl` input must contain one JSON object per targeted observation candidate. Each record must provide source location, `callStack.frames[]`, and optional `values.inputs`, `values.locals`, `values.outputs`, and `values.error` data using the ELIC captured value shape.

Capture validation rules:

- Structural schema validation allows `observation: null` so authored drafts can be hydrated.
- Readiness validation without hydration fails if an observed Step still has `observation: null`.
- Readiness validation fails if a Step with a non-null Observation lacks a `fileRange` Anchor.
- Readiness validation fails if a captured Flow has `origin: "cli"` but no valid `input.format` or repo-relative `input.path`.
- Readiness validation fails if a captured Flow has `origin: "authored"` and also has `input`.
- Normal viewing validation does not require `capture.input.path` to exist when inline Observations are present.
- `validate --hydrate` fails if `capture.input.path` cannot be read.

Snapshot/export behavior:

- Default hydration does not snapshot every file range.
- A snapshot/export option may populate snapshots for all file ranges for portability.

Strip behavior:

- v1 should include a way to strip generated fields for LLM editing/token minimization.
- Strip removes generated Anchor fields such as `source`, `integrity`, and generated fileRange `snapshot`.
- Strip replaces CLI-origin Observation objects with `null` placeholders while preserving `capture.input`, Step bodies, and Anchors.
- Strip keeps authored Observations because there is no CLI input path to rehydrate them.
- Strip keeps top-level `repo` fields, including `commit`.

Lint behavior:

- Lint is a validation flag, not a separate command.
- `elic validate --lint <explanation>` reports quality warnings after readiness checks.
- Missing `goal` is a lint warning only, never a validation error.
- More than three consecutive anchorless Steps may be a lint warning.
- Captured Flows with `origin: "authored"` produce a warning that runtime values were authored and should be verified.
- Captured Flows with missing `capture.input.path` files produce a warning during normal lint, but only fail when `--hydrate` needs to read them.
- OTel capture inputs that lack role-prefixed values cannot hydrate full function-centric Observations and should produce parser or lint diagnostics.
- Lint warnings do not fail validation unless a future strict flag is added.

## Presentation Surface Requirements

Active Surfaces are terminal and OpenCode.

Minimum Active Surface capabilities:

- Open an Explanation.
- Show Explanation title and description.
- Maintain Explanation Session state outside the Explanation artifact.
- Navigate Steps with next/previous.
- Navigate Topics with next/previous Topic.
- Support active Detail Level.
- Show current Step Markdown body.
- Show current Step Anchor evidence when present.
- Resolve and present `fileRange` Anchors using the resolution order in this document.
- Present `diffHunk` Anchors.
- Present `embeddedExcerpt` Anchors.
- When the active Step is inside a Flow, show adjacent Flow Step context together so paired evidence can be compared or traced.
- Keep Flow windowing or pairing behavior as Presentation Surface/session behavior, not Explanation artifact data.
- Render Capture Observations on captured Steps.
- Show `inputs`, `outputs`, and selected `locals` inline near the active Step Anchor when space and surface capabilities allow.
- Show full `inputs`, `locals`, `outputs`, and `error` details in an evidence details area.
- Show `callStack.frames` in a read-only call stack panel or equivalent read-only region.
- Show a lightweight indicator when Trace-level captured Steps are hidden by the active Detail Level, such as a hidden observation count.
- Show a subtle provenance badge for captured Flows, distinguishing CLI-origin and authored evidence.

Not required as shared v1 capabilities:

- Step jump lists.
- Flow jump navigation.
- LSP or symbol resolution.
- Web sharing.
- Editing Explanations inside the surface.

Candidate Surface:

- Web may influence portability, but does not define current v1 requirements.

Legacy Adapter:

- Neovim may remain historical code, but does not define the v1 Explanation contract.

## Authoring Workflow

Recommended agent workflow:

- Inspect the target repository before writing the Explanation.
- When a concrete runtime path is needed, run or request DAP, targeted OTel, or targeted structured-log capture before finalizing the captured Flow.
- Use capture-first hydration for captured Flows: inspect capture output, author Flow Steps with the runtime evidence in mind, mark hydratable Steps with `observation: null`, and run `elic validate --hydrate <explanation>`.
- Write authored JSON at `.elic/explanations/<human-slug>.explanation.json`.
- Minimize LLM output by omitting generated fields.
- Run `elic validate --hydrate <explanation>`.
- If hydration or validation fails, fix authored semantic fields and rerun.
- Optionally run `elic validate --hydrate --lint <explanation>` for quality warnings.
- Tell the user how to open the hydrated Explanation.

The LLM should not hand-author:

- `fileRange.source`.
- `fileRange.integrity`.
- `fileRange.snapshot`.
- Generated repo commit data unless explicitly provided by tooling.

The LLM may author:

- Explanation title and description.
- Optional goal when the Explanation is meant to be maintained or refreshed later.
- Topics, Flows, and Steps.
- Step bodies.
- Anchor targets.
- Flow `capture` metadata.
- `observation: null` placeholders for Steps that should be hydrated from capture input.
- Authored Observations when no CLI-readable capture input is available, with the expectation that lint warns and values are verified.
- `diffHunk` patch data when explaining diffs.
- `embeddedExcerpt` content when embedded evidence is the primary target.

Ephemeral implementation-summary Explanations normally omit `goal`, but they still require `createdAt` and hydrated evidence.
