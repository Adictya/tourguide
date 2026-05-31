# Inline Execution Capture in Flows

Execution Capture evidence will be stored inline in captured Flows and their Steps rather than as reusable standalone TourGuide artifacts. The decision favors authoring and presentation correctness for narrow runtime questions: a captured Flow preserves evidence order, each observed Step can pair one explanation with one source Anchor and one Capture Observation, and `capture.input.path` remains available only to rehydrate inline evidence from native DAP, OTel, or structured-log artifacts.

## Considered Options

- Standalone Execution Capture files referenced by Tours: better reuse and smaller Tours, but weaker fit for narrow question-specific evidence and more rendering dependency management.
- Step-only capture evidence: simple display, but it leaves evidence ordering as an unenforced convention.
- Flow-scoped capture with Step observations: preserves runtime order while keeping Step as the explanation unit and Anchor as the source range.

## Consequences

- Captured Flows become the contract boundary for ordered runtime paths.
- Native capture artifacts may persist as rehydration inputs, but Presentation Surfaces render from inline Observations.
- `tourguide validate --hydrate` must refresh observations by observed Step order and warn or fail when the raw capture points no longer match.
