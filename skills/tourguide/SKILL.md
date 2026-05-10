---
name: tourguide
description: Create strict JSON TourGuide artifacts for guided codebase, PR, implementation-summary, and static debug-flow tours. Use this skill when the user asks for a guided walkthrough, code tour, architecture explanation, PR tour, or implementation explanation that should be viewable with the TourGuide CLI/TUI.
metadata:
  author: adictya
  version: "0.1"
---

# TourGuide JSON Authoring Skill

## Purpose

TourGuide tours are strict JSON artifacts rendered by the `tourguide` CLI/TUI. The viewer is not an AI client. Your job is to inspect the target repository, create a grounded tour artifact, validate it, and tell the user how to open it.

## Workflow

1. Inspect the target codebase before writing the tour.
2. Identify the user goal: architecture, code path, PR diff, implementation summary, or debug flow.
3. Create `.tourguide/tours/<short-name>.json` in the target repository.
4. Use `schemaVersion: 1` and the canonical nested topic shape.
5. Keep v1 topics single-level. Put ordered `steps` directly inside each topic.
6. Prefer 5-15 steps. Split larger material into multiple tours.
7. Use exact repo-relative paths and line ranges after reading files.
8. Use explanation-only steps sparingly for mental models or summaries.
9. Run `tourguide validate .tourguide/tours/<short-name>.json`.
10. Tell the user how to open it with `tourguide view .tourguide/tours/<short-name>.json`.

## Artifact Shape

```json
{
  "schemaVersion": 1,
  "id": "short_stable_id",
  "title": "Tour Title",
  "intent": "Brief summary of why this tour exists.",
  "repo": {
    "vcs": "git",
    "rootHint": "Repository root"
  },
  "topics": [
    {
      "title": "1. Topic",
      "steps": [
        {
          "title": "Step title",
          "body": "Markdown explanation. Code spans like `effect()` render as terms.",
          "presentation": {
            "kind": "single"
          },
          "anchors": [
            {
              "kind": "fileRange",
              "path": "src/example.ts",
              "range": {
                "startLine": 10,
                "endLine": 24
              },
              "note": "Explain why this range matters."
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
- Do not include raw HTML in Markdown fields.
- Markdown image syntax and Mermaid fences are allowed, but must degrade gracefully in the TUI.
- Topic, step, and anchor `id` fields are optional; the core normalizer derives missing IDs.
- If a step has multiple anchors, include `primaryAnchorId` when a non-first anchor should receive initial focus.
- Use `presentation.kind = "flow"` for ordered multi-anchor execution paths.
- Use `presentation.kind = "compare"` for before/after or cross-file comparison.
- Use `presentation.kind = "diff"` for PR or implementation-summary diff hunks.
- Use selected excerpts or snapshots only when needed for portability; do not embed whole files by default.

## Quality Bar

- Every non-conceptual step should point at real code or a real diff hunk.
- Notes should explain why the code matters, not restate what the code says.
- The tour must make sense with only next/previous navigation.
- Do not invent file paths, line ranges, or symbols.
- If an anchor might be unstable, include a search or symbol locator when possible.
