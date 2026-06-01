# ELIC

ELIC (Explain Like I Code) is a TypeScript-first workspace for authored Explanations generated or maintained by AI agents and presented on local surfaces.

The canonical artifact is a strict JSON Explanation. An Explanation organizes Topics, optional Flows, ordered Steps, and grounded Anchors. Explanation Sessions are presented on Active Surfaces: terminal first and OpenCode next.

## Contract

- `CONTEXT.md` defines the project language.
- `docs/explanation-v1-contract.md` defines the draft v1 JSON artifact, authoring, validation, hydration, and Presentation Surface contract.
- Canonical authored Explanations live under `.elic/explanations/*.explanation.json`.
- Neovim is preserved only as a legacy adapter direction and does not define the v1 Explanation contract.

## Packages

- `packages/schema` owns the v1 Explanation contract and Effect Schema validation/parsing helpers.
- `packages/core` owns Explanation loading and core artifact helpers. Presentation Surfaces should not force alternate artifact shapes back into core.
- `packages/tui` contains the terminal visual direction. The UI vibe is retained; its current data model is not authoritative.
- `packages/cli` provides the command surface and should grow `elic` validation, hydration, strip, and view workflows from the v1 contract.
- `packages/tourguide.nvim` is historical legacy adapter code.
- `skills/elic` contains the JSON-authoring skill contract for agents.

## Commands

Current scaffold commands:

```sh
bun install
bun run build
bun run test
```

Target v1 authoring flow:

```sh
elic validate --hydrate .elic/explanations/<name>.explanation.json
elic validate --lint .elic/explanations/<name>.explanation.json
elic view .elic/explanations/<name>.explanation.json
```

## Current Status

This is an early scaffold in transition. Existing schema, core, CLI, fixtures, and authoring examples may not match the v1 contract yet. Treat `docs/explanation-v1-contract.md` and `CONTEXT.md` as the source of truth while the implementation is rebuilt.
