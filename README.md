# TourGuide

TourGuide is a TypeScript-first workspace for authored guided explanations generated or maintained by AI agents and presented on local surfaces.

The canonical artifact is a strict JSON Tour. A Tour organizes one explanation into Topics, optional Flows, ordered Steps, and grounded Anchors. Tour Sessions are presented on Active Surfaces: terminal first and OpenCode next.

## Contract

- `CONTEXT.md` defines the project language.
- `docs/tour-v1-contract.md` defines the draft v1 JSON artifact, authoring, validation, hydration, and Presentation Surface contract.
- Canonical authored Tours live under `.tourguide/tours/*.tour.json`.
- Neovim is preserved only as a legacy adapter direction and does not define the v1 Tour contract.

## Packages

- `packages/schema` owns the v1 Tour contract and Effect Schema validation/parsing helpers.
- `packages/core` owns normalization/session-model scaffolding. It is expected to be rewritten around Topics, Flows, Steps, Detail Levels, and single Anchors.
- `packages/tui` contains the terminal visual direction. The UI vibe is retained; its current data model is not authoritative.
- `packages/cli` provides the `tourguide` command surface and should grow validation, hydration, strip, and view workflows from the v1 contract.
- `packages/tourguide.nvim` is historical legacy adapter code.
- `skills/tourguide` contains the JSON-authoring skill contract for agents.

## Commands

Current scaffold commands:

```sh
bun install
bun run build
bun run test
```

Target v1 authoring flow:

```sh
tourguide validate --hydrate .tourguide/tours/<name>.tour.json
tourguide validate --lint .tourguide/tours/<name>.tour.json
tourguide view .tourguide/tours/<name>.tour.json
```

## Current Status

This is an early scaffold in transition. Existing schema, core, CLI, fixtures, and authoring examples may not match the v1 contract yet. Treat `docs/tour-v1-contract.md` and `CONTEXT.md` as the source of truth while the implementation is rebuilt.
