---
name: elic
description: Create strict JSON ELIC v1 Explanation artifacts for task-scoped code understanding, including bug diagnoses, PR explanations, architecture explanations, implementation summaries, code paths, and static debug flows. Use this skill when the user asks for a tailored code explanation that should be navigable and grounded in ELIC.
metadata:
  author: adictya
  version: "0.2"
---

# ELIC JSON Authoring Skill

## Purpose

ELIC Explanations are strict JSON artifacts rendered by ELIC Presentation Surfaces. Your job is to inspect the target repository, turn the user's current code-understanding question into a grounded authored Explanation artifact, hydrate and validate it with the CLI, and tell the user how to open it.

Most Explanations are one-off answers and do not need to be saved in the repository. Save an Explanation only when the user asks for it or when later discovery/revision is useful.

Use `CONTEXT.md` for language and `docs/explanation-v1-contract.md` for the v1 artifact contract. If implementation and docs disagree, follow the contract docs unless the user explicitly asks to work with legacy scaffold code.

## Workflow

1. Inspect the target codebase before writing the Explanation.
2. Decide whether the Explanation is one-off or saved. Default to one-off unless the user asks to keep it or future revision is useful.
3. Choose an output path. Use any explicit `.explanation.json` path for one-off Explanations, and use `.elic/explanations/<short-human-slug>.explanation.json` for saved Explanations.
4. Write strict JSON using `schemaVersion: 1` and the v1 authored shape.
5. Use exact repo-relative POSIX paths and inclusive line ranges after reading files.
6. Split multi-location material into adjacent Steps, usually inside a Flow.
7. Run `elic validate --hydrate <explanation-path>`.
8. If hydration or validation fails, fix authored semantic fields and rerun validation.
9. Optionally run `elic validate --hydrate --lint <explanation-path>` for quality warnings, especially for saved Explanations.
10. Tell the user how to open it with `elic view <explanation-path>` and whether it was saved or generated for the current question.

For runtime evidence work, see [Execution Capture Reference](../../docs/EXECUTION-CAPTURE.md). Treat it as prototype guidance only; do not add capture instructions to v1 Explanations.

## Authored Artifact Shape

This is the minimal authored shape. The CLI hydrates generated file evidence fields such as `repo.commit`, `fileRange.source`, `fileRange.integrity`, and generated snapshots.

```json
{
  "schemaVersion": 1,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Explanation Title",
  "description": "Concise user-facing summary of what this Explanation contains.",
  "createdAt": "2026-05-24T12:34:56.000Z",
  "defaultDetailLevel": 3,
  "topics": [
    {
      "title": "1. Topic",
      "items": [
        {
          "kind": "step",
          "body": "Markdown Step body for one conceptual move.",
          "anchor": {
            "kind": "fileRange",
            "path": "src/example.ts",
            "range": {
              "startLine": 10,
              "endLine": 24
            }
          }
        },
        {
          "kind": "flow",
          "title": "Callsite to implementation",
          "steps": [
            {
              "kind": "step",
              "body": "This callsite hands control to `run()`.",
              "anchor": {
                "kind": "fileRange",
                "path": "src/example.ts",
                "range": {
                  "startLine": 30,
                  "endLine": 35
                }
              }
            },
            {
              "kind": "step",
              "body": "`run()` performs the work reached from the callsite.",
              "anchor": {
                "kind": "fileRange",
                "path": "src/run.ts",
                "range": {
                  "startLine": 5,
                  "endLine": 18
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Authoring Rules

- Write strict JSON, not JSONC, YAML, Lua, or Markdown-only output.
- Use `.explanation.json` filenames.
- Put saved Explanations under `.elic/explanations/`; one-off Explanations may use any explicit path.
- Use a UUID for `id`; prefer CLI/scaffold/tool generation when available.
- Use ISO 8601 for `createdAt`; preserve it during revisions.
- Use `description` for user-facing contents summary.
- Use `goal` only for saved Explanations that may need future LLM refresh.
- Use `defaultDetailLevel` only when the Explanation should recommend a starting level other than the default Deep Dive value of `3`.
- Use `minDetailLevel` on Steps or Flows when content should appear only at Explore or Deep Dive.
- Keep Topic and Flow titles plain text.
- Put all prose in Step `body`; Topics and Flows do not have Markdown bodies.
- Do not write Step titles.
- Do not write `presentation` fields.
- Do not write `anchors[]`; a Step has at most one `anchor`.
- Do not write `primaryAnchorId`.
- Do not write Anchor IDs, Anchor notes, Anchor roles, `locator.search`, or `locator.symbol`.
- Do not hand-author generated fields: `fileRange.source`, `fileRange.integrity`, or `fileRange.snapshot`.
- Do not hand-author `repo.commit` unless tooling supplied the exact commit.

## Anchor Rules

- Use `fileRange` for repo-linked source evidence.
- Use `diffHunk` for PR or implementation-summary diff evidence; diff is an Anchor kind, not a presentation mode.
- Use `embeddedExcerpt` only when the selected evidence is not a resolvable repo file or must be authored as portable embedded evidence.
- Use repo-relative POSIX paths with no absolute paths and no `..` traversal.
- Use 1-based inclusive line ranges.
- Do not use columns in v1.
- Reuse the same Anchor target in multiple Steps when the same evidence supports different conceptual moves.
- For branching call graphs, create multiple linear Flows and repeat shared callsite Anchors where needed.

## Markdown Rules

- Step bodies are Markdown.
- Do not include raw HTML.
- Do not include image syntax.
- Mermaid is allowed only as fenced code blocks and must make sense as source when not rendered.
- Markdown links are allowed.
- Internal links may target Topics and Flows, not individual Steps.
- Use canonical language IDs for code fences and embedded excerpts when a language is specified: `bash`, `css`, `diff`, `html`, `javascript`, `json`, `jsonc`, `jsx`, `lua`, `markdown`, `python`, `rust`, `tsx`, `typescript`, `text`, or `yaml`.
- Do not use aliases such as `js`, `ts`, `sh`, or `md`.

## Flow Rules

- Use a Flow for adjacent Steps that should be understood together as one path, comparison, trace, or tightly coupled sequence.
- A Flow must contain at least two Steps.
- A Flow cannot contain another Flow.
- Step remains the unit of next/previous navigation.
- Do not encode pairing/window layout in the Explanation. Presentation Surfaces decide how adjacent Flow Steps are shown together.
- If the path branches, use multiple Flows rather than making a Flow graph.

## Quality Bar

- The Explanation must make sense with only next/previous Step navigation and Topic-level navigation.
- Each Step should advance one conceptual move.
- Every concrete Step should point at real code, a real diff hunk, or selected embedded evidence.
- Anchorless Steps are allowed for mental models, transitions, or summaries, but should not become a long essay.
- Do not invent file paths, line ranges, diff hunks, symbols, or APIs.
- Do not embed whole files by default.
- Prefer one coherent Explanation over many tiny Explanations, but split when the material becomes too broad.
- If the Explanation is one-off, omit `goal`; if it is saved for later refresh, include a concise LLM-facing `goal`.
