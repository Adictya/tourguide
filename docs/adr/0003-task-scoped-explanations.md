# Treat Explanations as task-scoped presentation artifacts

Status: accepted

ELIC Explanations are primarily a way to present tailored AI answers about code, not a way to maintain a long-lived project knowledge base. Common use cases include understanding why a bug happened, reviewing a PR at different Detail Levels, inspecting a code path, summarizing an implementation, or exploring how a library architecture is changing.

The Explanation artifact remains central because it is the transport and validation boundary between the agent and the Presentation Surface. It lets an answer become navigable, grounded in Anchors, grouped into Topics and Flows, and enriched with Capture Observations when runtime evidence matters. The artifact's existence does not imply that every Explanation should be saved, committed, or maintained.

## Decision

- One-off Explanations are the default unless the user asks to save the Explanation or later discovery/revision is clearly useful.
- Saved Explanations live under `.elic/explanations/*.explanation.json` and may include `goal` for future LLM refresh.
- One-off Explanations may use any explicit `.explanation.json` path and normally omit `goal`.
- Presentation Surfaces must open an explicit Explanation path, not only a saved Explanation picker.
- ELIC should not be framed as a wiki, docs site, living documentation platform, or durable onboarding tour system.

## Consequences

- Product language should emphasize task-scoped code understanding and local presentation of AI-generated answers.
- CLI and surface workflows should optimize for `ask agent -> generate Explanation -> validate/hydrate -> view immediately -> optionally save`.
- Default discovery can still prefer `.elic/explanations/`, but discovery is for Explanations the user intentionally saved.
- Authoring tools should avoid pushing every generated Explanation into the repository.
- Legacy tour-oriented code may remain as an adapter direction, but it should not shape the v1 Explanation contract.
