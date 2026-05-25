# Tour v1 Contract Draft

This document captures the current Tour v1 artifact, authoring, validation, hydration, and Presentation Surface contract. `CONTEXT.md` remains the glossary; this file is the working product/specification contract.

## Status

This is a draft based on accepted domain decisions. Existing schema, core, CLI, and skill implementation may be treated as obsolete unless explicitly carried forward. The current TUI only preserves visual direction, not its data model.

## Core Model

A Tour is a strict JSON artifact. It is not a Tour Session, a rendered screen, or a Presentation Surface.

The canonical authored location is `.tourguide/tours/<human-slug>.tour.json`.

CLI commands may accept any explicit path. Default discovery should prefer `.tourguide/tours/*.tour.json`.

Tour files must use strict JSON, not JSONC, YAML, Lua, or Markdown-only output.

## Top-Level Fields

Required fields:

- `schemaVersion`: numeric artifact schema version. v1 uses `1`.
- `id`: generated stable UUID string for machine/server identity.
- `title`: plain-text title.
- `description`: concise user-facing summary of what the Tour contains.
- `createdAt`: ISO 8601 date-time for when the Tour artifact was first created.
- `topics`: non-empty array of Topics.

Optional fields:

- `goal`: LLM-facing maintenance/revision intent. Omit for ephemeral one-off Tours.
- `defaultDetailLevel`: numeric recommended starting Detail Level. Allowed values are `1`, `2`, `3`. If omitted, default is `3`.
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

Tour content may use `minDetailLevel` on Steps and Flows. If omitted, `minDetailLevel` defaults to `1`.

Rules:

- Higher Detail Levels include lower-level content.
- There is no `maxDetailLevel`.
- Topics do not have `minDetailLevel`.
- Anchors do not have `minDetailLevel`.
- A Tour Session owns the active Detail Level.
- Changing active Detail Level never mutates the Tour artifact.
- Topic navigation skips Topics with no included Steps after Detail Level filtering.
- If a Flow has fewer than two included Steps after filtering, its grouping dissolves for that Tour Session. One remaining Step is presented as a normal Step; zero remaining Steps are skipped.

## Structure

A Tour contains Topics. A Topic contains an ordered mixed list of standalone Steps and Flows. A Flow contains ordered Steps only.

### Topic

Required fields:

- `title`: non-empty plain text.
- `items`: non-empty ordered array of `step` or `flow` items.

Topic rules:

- No Topic `body`.
- Topic titles are the higher-order navigation labels.
- Topic title slugs must be globally unique in the Tour for internal links.

### Flow

Required fields:

- `kind`: `flow`.
- `title`: non-empty plain text.
- `steps`: at least two Steps.

Optional fields:

- `minDetailLevel`: `1`, `2`, or `3`; default `1`.

Flow rules:

- No Flow `body`.
- No nested Flows.
- Flow title slugs must be globally unique in the Tour for internal links.
- Step remains the unit of next/previous navigation.
- Flow is not a formal higher-order navigation target.
- Flow presentation requires adjacent Step relationships to be visible together, but not necessarily every Step in the Flow at once.
- Branching call graphs should be represented as multiple linear Flows, with repeated Anchor targets when a callsite is revisited for a different branch.

### Step

Required fields:

- `kind`: `step`.
- `body`: non-empty Markdown explanation.

Optional fields:

- `anchor`: one Anchor.
- `minDetailLevel`: `1`, `2`, or `3`; default `1`.

Step rules:

- No Step `title`.
- No Step `presentation`.
- No `anchors` array.
- No `primaryAnchorId`.
- A Step may be anchorless for conceptual framing, transitions, or summaries.
- A concrete claim about code should normally have an Anchor.
- The same Anchor target may appear in multiple Steps when the same evidence supports different conceptual moves.

## Anchors

A Step has zero or one Anchor. An Anchor identifies grounded evidence; explanation belongs in the Step body.

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

- Diff display mode is a Presentation Surface or user preference, not Tour data.
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

- `rootHint`: human-readable hint for where the Tour expects to be opened.
- `remoteUrl`: optional remote identity; do not require it because it may be absent or sensitive.
- `baseRef`: optional revision context for PR or implementation-summary Tours.
- `headRef`: optional revision context for PR or implementation-summary Tours.

Hydration rules:

- Authored Tours may omit `repo`.
- If any `fileRange` Anchor exists, hydrated output has `repo.vcs` and `repo.commit`.
- If `repo.commit` is missing, hydration sets it to the current Git `HEAD`.
- If `repo.commit` already exists, default hydration does not silently rebase the Tour to a new commit.

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
- Topic and Flow slugs must be globally unique in the Tour.
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

Authored and hydrated Tours are both Tours. They are not separate domain concepts and no lifecycle state is embedded in the artifact.

Authored shape:

- Minimal LLM/user output.
- Includes semantic structure, Step bodies, and Anchor targets.
- Does not include `fileRange.source`.
- Does not include `fileRange.integrity`.
- Does not include `fileRange.snapshot`.
- May omit `repo` when tooling can infer it.

Hydrated shape:

- Ready for validation and viewing.
- Includes generated repo context when needed.
- Includes generated `fileRange.source`.
- Includes generated `fileRange.integrity`.
- Includes generated `fileRange.snapshot` for working-tree file ranges or explicit portable export.

Generated fields remain inline on Anchors. They are not grouped under a `generated` object.

## Validation and Hydration

`tourguide validate <tour>` is read-only and means the Tour can be presented correctly on the current machine.

Validation behavior:

- Always validate JSON structure.
- Always validate Markdown restrictions.
- Always validate internal links.
- Validate only external dependencies the Tour actually uses.
- If no `fileRange` Anchors exist, Git validation is not required.
- `diffHunk` and `embeddedExcerpt` Anchors can validate without Git because they embed their evidence.
- `fileRange` Anchors require enough available evidence to present correctly.

fileRange presentation resolution order:

- Prefer live working tree content only when integrity exists and matches.
- Otherwise use `repo.commit` content when available.
- Otherwise use generated `snapshot` when available.
- Otherwise validation/view fails.

`tourguide validate --hydrate <tour>` is mutating.

Hydration behavior:

- Performs structural validation first.
- Fills generated repo context when needed.
- Infers and writes `fileRange.source` per Anchor.
- Regenerates `fileRange.integrity`.
- Generates snapshots for `workingTree` file ranges.
- Does not generate snapshots for commit-backed file ranges by default.
- Can switch generated `source` between `commit` and `workingTree` when the current evidence state changes.
- Can remove generated snapshots when they are no longer required, unless snapshot/export mode requested them.
- Can remove stale generated fileRange fields when an Anchor is no longer a `fileRange`.
- Does not rewrite authored fields such as title, description, goal, Topic/Flow titles, Step bodies, paths, ranges, or ordering.

Snapshot/export behavior:

- Default hydration does not snapshot every file range.
- A snapshot/export option may populate snapshots for all file ranges for portability.

Strip behavior:

- v1 should include a way to strip generated fields for LLM editing/token minimization.
- Strip removes generated Anchor fields such as `source`, `integrity`, and generated fileRange `snapshot`.
- Strip keeps top-level `repo` fields, including `commit`.

Lint behavior:

- Lint is a validation flag, not a separate command.
- `tourguide validate --lint <tour>` reports quality warnings after readiness checks.
- Missing `goal` is a lint warning only, never a validation error.
- More than three consecutive anchorless Steps may be a lint warning.
- Lint warnings do not fail validation unless a future strict flag is added.

## Presentation Surface Requirements

Active Surfaces are terminal and OpenCode.

Minimum Active Surface capabilities:

- Open a Tour.
- Show Tour title and description.
- Maintain Tour Session state outside the Tour artifact.
- Navigate Steps with next/previous.
- Navigate Topics with next/previous Topic.
- Support active Detail Level.
- Show current Step Markdown body.
- Show current Step Anchor evidence when present.
- Resolve and present `fileRange` Anchors using the resolution order in this document.
- Present `diffHunk` Anchors.
- Present `embeddedExcerpt` Anchors.
- When the active Step is inside a Flow, show adjacent Flow Step context together so paired evidence can be compared or traced.
- Keep Flow windowing or pairing behavior as Presentation Surface/session behavior, not Tour artifact data.

Not required as shared v1 capabilities:

- Step jump lists.
- Flow jump navigation.
- LSP or symbol resolution.
- Web sharing.
- Editing Tours inside the surface.

Candidate Surface:

- Web may influence portability, but does not define current v1 requirements.

Legacy Adapter:

- Neovim may remain historical code, but does not define the v1 Tour contract.

## Authoring Workflow

Recommended agent workflow:

- Inspect the target repository before writing the Tour.
- Write authored JSON at `.tourguide/tours/<human-slug>.tour.json`.
- Minimize LLM output by omitting generated fields.
- Run `tourguide validate --hydrate <tour>`.
- If hydration or validation fails, fix authored semantic fields and rerun.
- Optionally run `tourguide validate --hydrate --lint <tour>` for quality warnings.
- Tell the user how to open the hydrated Tour.

The LLM should not hand-author:

- `fileRange.source`.
- `fileRange.integrity`.
- `fileRange.snapshot`.
- Generated repo commit data unless explicitly provided by tooling.

The LLM may author:

- Tour title and description.
- Optional goal when the Tour is meant to be maintained or refreshed later.
- Topics, Flows, and Steps.
- Step bodies.
- Anchor targets.
- `diffHunk` patch data when explaining diffs.
- `embeddedExcerpt` content when embedded evidence is the primary target.

Ephemeral implementation-summary Tours normally omit `goal`, but they still require `createdAt` and hydrated evidence.
