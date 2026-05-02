---
name: tourguide
description: Create guided codebase tours that teach a repository inside Neovim using the included TourGuide runtime. Use this skill whenever the user asks for a code walkthrough, architecture review, onboarding tour, guided review path, feature-path explanation, bug-path explanation, migration tour, or a TourGuide Lua file. Also use it when the user wants to show or run an existing tour with Neovim and the included tourguide.lua runtime.
---

# TourGuide Authoring Skill

## Purpose

TourGuide renders ordered code walkthroughs in Neovim. Inspect the target codebase, design a coherent learning path, and produce a Lua tour table that guides the user through files, code sections, markdown explanations, and split views.

The skill directory includes `tourguide.lua`, a self-contained TourGuide runtime. Use it to show tours in Neovim without extra setup.

## Runtime Functionality

The runtime supports:

- Topic/subtopic hierarchy in the sidebar.
- Linear top-down/bottom-up navigation with `:TourGuideNext` and `:TourGuidePrev`.
- Top-level topic navigation with `:TourGuideNextTopic` and `:TourGuidePrevTopic`.
- First-run temporary keymap prompts saved under Neovim's state directory.
- Real source buffers opened read-only in normal file buffers.
- Non-mutating code annotations via virtual text / virtual lines.
- Multiple highlighted sections per file step.
- Markdown-only explanation steps in scratch buffers.
- Split views with `layout = "vertical"` or `layout = "horizontal"`.
- Flow numbering in split views with `flow = true`.
- Section locators by exact line `range`, literal `search`, or `symbol` text.

Commands:

- `:TourGuide {path-or-module}` starts a tour.
- `:TourGuideNext` advances.
- `:TourGuidePrev` goes back.
- `:TourGuideNextTopic` advances to the next top-level topic.
- `:TourGuidePrevTopic` goes back to the previous top-level topic.
- `:TourGuideJump {n}` jumps to a step.
- `:TourGuideClose` closes the tour.

On first tour start, users can choose temporary normal-mode mappings for section and topic navigation. Empty answers disable mappings. The mappings are restored to their previous global values when the tour closes.

## Showing Tours

Use Neovim to load the included runtime and then start the tour:

```sh
nvim -c 'luafile /path/to/skills/tourguide/tourguide.lua' -c 'TourGuide /path/to/tour.lua'
```

If the tour teaches a separate project, set `root = os.getenv("TOURGUIDE_ROOT") or vim.fn.getcwd()` in the tour file and include `TOURGUIDE_ROOT` in the run command:

```sh
TOURGUIDE_ROOT=/path/to/project nvim -c 'luafile /path/to/skills/tourguide/tourguide.lua' -c 'TourGuide /path/to/tour.lua'
```

At the end of every tour-writing task, tell the user the exact command to run. Use the actual tour path you wrote and the actual path to this skill's `tourguide.lua` when known.

## Tour Schema

```lua
return {
  id = "tour_id",
  title = "Tour Title",
  root = vim.fn.getcwd(),
  topics = {
    {
      title = "1. Topic",
      children = {
        {
          title = "Markdown concept page",
          markdown = [[# Concept\nExplain the model.]],
        },
        {
          title = "File step",
          file = "src/core.ts",
          sections = {
            { range = { 10, 30 }, note = "Why this block matters." },
            { search = "function run", context = 12, note = "Literal search fallback." },
          },
        },
        {
          title = "Split flow",
          layout = "vertical",
          flow = true,
          panes = {
            { file = "src/a.ts", sections = { { range = { 1, 20 }, note = "[01] is added automatically." } } },
            { file = "src/b.ts", sections = { { range = { 40, 70 }, note = "Then continue here." } } },
          },
        },
      },
    },
  },
}
```

## Planning Workflow

1. First inspect the codebase. Do not invent file paths or line ranges.
2. Identify the user's learning goal: architecture, bug path, feature path, migration, API design, performance, async flow, etc.
3. Choose 3-8 top-level topics. Each topic should represent a conceptual phase, not merely a folder.
4. Inside each topic, order steps by dependency: concepts first, API entrypoints second, internal machinery third, edge cases/tests last.
5. Prefer exact `range = { start, end }` sections after reading files. Use `search` only when line numbers are likely unstable.
6. Keep each file step focused. One step should teach one idea, with 1-5 highlighted sections.
7. Use markdown steps when the user needs a mental model before seeing code.
8. Use split steps only when back-and-forth across files is essential, such as call stacks, data flow, scheduler flow, or client/server pairs.
9. For split steps, use `flow = true` so numbered notes make cross-pane order obvious.
10. Notes should explain why the section matters, not restate the code.

## Good Topic Design

Prefer:

- "Public API Entry"
- "Core State Machine"
- "Async Resume Path"
- "Boundary/Error Propagation"
- "Tests That Lock Behavior"

Avoid:

- "Files"
- "Utils"
- "More Code"
- A tour that follows alphabetical file order.

## Note Style

Good notes:

- "This is where the compute phase enters tracking context; every dependency discovered after this point becomes part of the graph."
- "This queue only runs when the lane has no pending async, which prevents the apply callback from observing half-settled state."

Bad notes:

- "This function runs."
- "This line imports things."
- "Here is the code."

## Verification

Run Lua syntax checks if possible:

```sh
lua -e 'assert(loadfile("tours/my_tour.lua"))'
```

## Constraints

- Do not modify source files being toured.
- Do not create enormous steps. Split dense concepts into multiple steps.
- Do not use split views for unrelated files.
- Do not rely on random navigation. The tour must make sense with only next/prev.
- If line ranges are approximate, say so in the note or use `search`.
