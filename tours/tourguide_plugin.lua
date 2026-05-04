return {
  id = "tourguide_plugin",
  title = "tourguide.nvim Internals",
  root = vim.fn.getcwd(),
  topics = {
    {
      title = "1. Entry Points",
      children = {
        {
          title = "Plugin Startup",
          file = "plugin/tourguide.lua",
          sections = {
            {
              range = { 1, 6 },
              note = "Neovim loads this plugin file from runtimepath. It guards against duplicate setup, then registers TourGuide commands through require('tourguide').setup().",
            },
          },
        },
        {
          title = "Public API",
          file = "lua/tourguide/init.lua",
          sections = {
            {
              range = { 9, 18 },
              note = "Starting a tour loads the tour table, resets state, renders the sidebar and first step, then activates temporary navigation mappings.",
            },
            {
              range = { 27, 36 },
              note = "Closing restores keymaps, clears extmarks from tour buffers, and resets shared state.",
            },
            {
              range = { 39, 50 },
              note = "Setup exposes the command surface used by users and keymaps.",
            },
          },
        },
      },
    },
    {
      title = "2. Tour Data",
      children = {
        {
          title = "Loading And Flattening",
          file = "lua/tourguide/loader.lua",
          sections = {
            {
              range = { 7, 21 },
              note = "Tour topics can contain nested children, but render/navigation works from a flat ordered step list with display metadata.",
            },
            {
              range = { 37, 49 },
              note = "A tour can be loaded from a Lua file or module. If no root is provided, the current working directory becomes the tour root.",
            },
          },
        },
        {
          title = "Section Resolution",
          file = "lua/tourguide/resolve.lua",
          sections = {
            {
              range = { 7, 23 },
              note = "Sections resolve either from explicit line ranges or a plain-text search with optional context.",
            },
          },
        },
      },
    },
    {
      title = "3. Rendering",
      children = {
        {
          title = "Window Layout",
          file = "lua/tourguide/layout.lua",
          sections = {
            {
              range = { 19, 29 },
              note = "Rendering avoids using the sidebar as the content window and creates one if needed.",
            },
            {
              range = { 44, 54 },
              note = "Split-pane flows add sequential numbers to section notes without changing source buffers.",
            },
            {
              range = { 95, 127 },
              note = "The main render function handles markdown steps, split panes, and single-file steps through the same window bookkeeping.",
            },
          },
        },
        {
          title = "Annotations And Dimming",
          file = "lua/tourguide/annotations.lua",
          sections = {
            {
              range = { 6, 9 },
              note = "TourGuideDim is the user-overridable highlight group for dimming surrounding code.",
            },
            {
              range = { 23, 35 },
              note = "Selected tour sections are recorded but not directly highlighted, preserving their normal syntax colors.",
            },
            {
              range = { 37, 60 },
              note = "Notes are rendered as virtual text or virtual lines near the selected section.",
            },
            {
              range = { 64, 76 },
              note = "Lines outside selected sections receive blended range highlights, dimming them without flattening syntax highlighting.",
            },
          },
        },
      },
    },
    {
      title = "4. Interaction",
      children = {
        {
          title = "Sidebar",
          file = "lua/tourguide/sidebar.lua",
          sections = {
            {
              range = { 12, 40 },
              note = "The sidebar is a fixed-width scratch window that is reused across navigation.",
            },
            {
              range = { 43, 88 },
              note = "Rendering rebuilds the topic list, active step marker, and sidebar highlights from current state.",
            },
          },
        },
        {
          title = "Navigation",
          file = "lua/tourguide/navigation.lua",
          sections = {
            {
              range = { 7, 18 },
              note = "All movement funnels through jump: update index, redraw sidebar, then render the selected step.",
            },
            {
              range = { 24, 60 },
              note = "Topic navigation uses the flattened step breadcrumbs to jump across top-level sections.",
            },
          },
        },
        {
          title = "Temporary Keymaps",
          file = "lua/tourguide/keymaps.lua",
          sections = {
            {
              range = { 5, 15 },
              note = "TourGuide can prompt for temporary mappings and stores preferences under stdpath('state').",
            },
            {
              range = { 63, 80 },
              note = "Activation saves existing mappings before installing tour mappings, so close can restore the user's previous setup.",
            },
            {
              range = { 84, 97 },
              note = "Keymap prompting is skipped in headless mode or when prompt_keymaps is disabled.",
            },
          },
        },
      },
    },
    {
      title = "5. Distribution",
      children = {
        {
          title = "Bundled Runtime",
          file = "scripts/bundle.lua",
          sections = {
            {
              search = "local modules =",
              context = 20,
              note = "The bundle script concatenates runtime modules into the self-contained skill loader copy.",
            },
          },
        },
        {
          title = "How To Run This Tour",
          markdown = [[# Run the local plugin tour

From this repository:

```sh
nvim --cmd 'set rtp+=.' -c 'TourGuide tours/tourguide_plugin.lua'
```

If you are already inside Neovim:

```vim
:set rtp+=.
:runtime plugin/tourguide.lua
:TourGuide tours/tourguide_plugin.lua
```
]],
        },
      },
    },
  },
}
