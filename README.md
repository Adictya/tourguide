# tourguide.nvim

Guided codebase tours for Neovim. A tour is a Lua table that describes topics, ordered steps, source files, highlighted code sections, virtual notes, markdown-only explanation pages, and split views for cross-file flows.

## Features

- Topic/subtopic sidebar with section and topic navigation.
- Source files opened in real buffers without modifying contents.
- Code sections highlighted with extmarks and virtual notes.
- Markdown explanation steps in scratch buffers.
- Vertical/horizontal split steps for call paths or data flow across files.
- Flow numbering across split panes.
- Plain Lua tour files; no external runtime dependencies.

## Install

With lazy.nvim:

```lua
{
  "path/to/tourguide.nvim",
  config = function()
    require("tourguide").setup({ sidebar_width = 34 })
  end,
}
```

For local testing from the plugin repo:

```sh
nvim -c 'set rtp+=.' -c 'TourGuide tours/solid_effects_async.lua'
```

For the bundled Solid tour from another repo:

```sh
TOURGUIDE_ROOT=/path/to/solid nvim -c 'set rtp+=/path/to/tourguide.nvim' -c 'TourGuide /path/to/tourguide.nvim/tours/solid_effects_async.lua'
```

## Bundled Skill Loader

The repository can generate `skills/tourguide/tourguide.lua`, a single-file build of the runtime modules for use beside the TourGuide authoring skill:

```sh
make bundle
```

The generated file is self-contained and should not be edited manually.

## Commands

- `:TourGuide {path-or-module}` starts a tour.
- `:TourGuideNext` moves to the next step.
- `:TourGuidePrev` moves to the previous step.
- `:TourGuideNextTopic` moves to the next top-level topic.
- `:TourGuidePrevTopic` moves to the previous top-level topic.
- `:TourGuideJump {n}` jumps to step number `n`.
- `:TourGuideClose` closes the tour sidebar and clears annotations.

## Temporary Mappings

On first tour start, TourGuide prompts for temporary normal-mode mappings for next section, previous section, next topic, and previous topic. Choices are saved to `stdpath("state")/tourguide/keymaps.json`; submitting an empty answer disables that mapping.

Mappings are only active while a tour is running. When the tour closes, TourGuide removes its mappings and restores any global mappings that were present before the tour started.

To use commands only, disable prompts during setup:

```lua
require("tourguide").setup({ prompt_keymaps = false })
```

## Tour Schema

```lua
return {
  id = "my_tour",
  title = "My Tour",
  root = vim.fn.getcwd(),
  topics = {
    {
      title = "1. Topic",
      children = {
        {
          title = "Markdown concept page",
          markdown = [[# Concept\nExplain the model here.]],
        },
        {
          title = "File step",
          file = "src/core.ts",
          sections = {
            { range = { 10, 30 }, note = "This block creates the node." },
            { search = "function run", context = 12, note = "Search-based section." },
          },
        },
        {
          title = "Split flow",
          layout = "vertical",
          flow = true,
          panes = {
            { file = "src/a.ts", sections = { { range = { 1, 20 }, note = "Start here." } } },
            { file = "src/b.ts", sections = { { range = { 40, 70 }, note = "Then here." } } },
          },
        },
      },
    },
  },
}
```

## Highlight Groups

- `TourGuideTitle`
- `TourGuideTopic`
- `TourGuideActive`
- `TourGuideFile`
- `TourGuidePrefix`
- `TourGuideNote`
- `TourGuideFlowSection`
