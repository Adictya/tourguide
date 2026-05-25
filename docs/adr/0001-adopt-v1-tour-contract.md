# Adopt the v1 Tour contract

Status: accepted

TourGuide's scaffold schema allowed Step titles, multiple Anchors per Step, Step-level presentation kinds, Anchor notes, and legacy viewer assumptions. We decided to replace that scaffold with the v1 Tour contract: titleless Steps with one optional Anchor, first-class Flows for adjacent multi-Step context, additive Detail Levels, and generated hydration metadata for reliable evidence presentation.

This favors a smaller LLM-authored artifact and a clearer domain model over preserving the original renderer-shaped JSON. The consequence is that existing schema, core, CLI, fixtures, and authoring examples may be rewritten around the v1 contract; the terminal TUI can preserve its visual direction but not its current data model.
