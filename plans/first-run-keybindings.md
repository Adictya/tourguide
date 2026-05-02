# First-Run Keybindings Plan

## Goal

When a user starts TourGuide for the first time, prompt for temporary navigation keybindings:

- Next section
- Previous section
- Next topic
- Previous topic

The answers should be saved under Neovim's state directory and reused on future starts. Empty answers mean that action should not be bound.

When the tour closes, TourGuide should restore whatever mappings existed before the tour started.

## Current State

- `:TourGuideNext` and `:TourGuidePrev` navigate linearly through flattened steps.
- There are no topic navigation commands yet.
- README currently suggests manual mappings.
- Tour state is stored in `lua/tourguide/state.lua`.
- `M.close()` in `lua/tourguide/init.lua` clears annotations and resets state.

## Design

Add topic navigation and a temporary keymap manager.

The prompt should happen on first tour start, not during `setup()`. This avoids interrupting plugin installation/startup and only asks once the user actually uses TourGuide.

Suggested persisted file:

```text
stdpath("state")/tourguide/keymaps.json
```

Suggested JSON shape:

```json
{
  "next_section": "]t",
  "prev_section": "[t",
  "next_topic": "]T",
  "prev_topic": "[T"
}
```

Empty strings should be saved and interpreted as disabled mappings.

## Files To Add Or Change

- Add `lua/tourguide/keymaps.lua`.
- Update `lua/tourguide/navigation.lua` for topic movement.
- Update `lua/tourguide/init.lua` to initialize and restore temporary keymaps.
- Update `lua/tourguide/state.lua` if keymap lifecycle state belongs there.
- Update `README.md` and `doc/tourguide.txt`.
- Update `skills/tourguide/SKILL.md`.

## Commands To Add

- `:TourGuideNextTopic`
- `:TourGuidePrevTopic`

Existing commands remain:

- `:TourGuideNext`
- `:TourGuidePrev`
- `:TourGuideJump`
- `:TourGuideClose`

## Topic Navigation

Use each step's existing `step._breadcrumbs[1]` as its top-level topic.

`next_topic` behavior:

- Start from `state.index + 1`.
- Find the first step whose top-level topic differs from the current step's topic.
- Jump there.
- If no later topic exists, show the existing end-of-tour style notification.

`prev_topic` behavior:

- Start from `state.index - 1`.
- Find the nearest earlier step whose top-level topic differs from the current step's topic.
- Continue walking backward to that topic's first step.
- Jump to the first step of that previous topic.
- If no earlier topic exists, show the existing end-of-tour style notification.

## Keymap Lifecycle

On `TourGuide.start()`:

1. Load saved keymap preferences.
2. If no saved file exists, prompt for all four actions with `vim.ui.input`.
3. Save the resulting preferences.
4. Snapshot any existing normal-mode mappings for the chosen keys with `vim.fn.maparg(lhs, "n", false, true)`.
5. Set temporary normal-mode mappings for non-empty keys.

On `TourGuide.close()`:

1. For every TourGuide temporary mapping, remove the TourGuide mapping.
2. Restore the previous mapping if one existed.
3. Clear keymap snapshot state.
4. Continue clearing annotations and resetting TourGuide state.

If `TourGuide.start()` is called while another tour is active, restore previous temporary mappings before applying new ones.

## Prompt Flow

Use sequential `vim.ui.input` prompts:

```text
TourGuide next section keymap (empty to skip):
TourGuide previous section keymap (empty to skip):
TourGuide next topic keymap (empty to skip):
TourGuide previous topic keymap (empty to skip):
```

Sequential prompts are simple and work with default `vim.ui.input` and UI plugins.

If the user cancels a prompt, treat it as an empty string for that action and continue. This keeps first-run setup non-blocking.

## Mapping Restore Details

Restoring mappings should prefer exact metadata from `maparg(..., true)`:

- `rhs`
- `callback`
- `expr`
- `noremap`
- `silent`
- `desc`
- `buffer`, if relevant

Because this plugin should set global normal-mode mappings, the first implementation can restrict restore to global normal-mode mappings. If a buffer-local mapping exists for the same lhs, do not overwrite it.

## Setup Options

Keep setup minimal, but add optional escape hatches if needed:

```lua
require("tourguide").setup({
  sidebar_width = 34,
  prompt_keymaps = true,
})
```

`prompt_keymaps = false` would be useful for headless tests or users who only want commands.

## Documentation Updates

Update docs to explain:

- First-run prompt behavior.
- Where preferences are stored.
- Empty prompts disable mappings.
- Mappings are temporary for active tours and restored on close.
- New topic navigation commands.

## Verification

Manual checks:

```sh
nvim -c 'set rtp+=.' -c 'TourGuide tours/solid_effects_async.lua'
```

Then confirm:

- First start prompts for four mappings.
- Saved choices are reused on the next start.
- Empty choices do not create mappings.
- Existing mappings are restored after `:TourGuideClose`.
- `:TourGuideNextTopic` and `:TourGuidePrevTopic` move between top-level topics.

Headless checks:

```sh
nvim --headless -u NONE -c 'set rtp+=.' -c 'lua require("tourguide").setup({ prompt_keymaps = false })' -c 'TourGuide tours/solid_effects_async.lua' -c 'TourGuideNextTopic' -c 'TourGuidePrevTopic' -c 'TourGuideClose' -c 'qa!'
```

## Risks

- `vim.ui.input` is asynchronous, so `start()` may need to defer applying keymaps until prompts finish.
- Mapping restoration can be subtle when users have buffer-local mappings or plugin-managed mappings.
- Prompting during headless Neovim can block unless disabled or automatically skipped.

## Non-Goals

- Do not require keybindings; commands must remain fully usable.
- Do not overwrite saved preferences on every start.
- Do not add a custom floating UI unless `vim.ui.input` proves insufficient.
