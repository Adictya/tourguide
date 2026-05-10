local state = require("tourguide.state")
local sidebar = require("tourguide.sidebar")
local layout = require("tourguide.layout")

local M = {}

function M.jump(index)
  if not state.tour then
    vim.notify("No active TourGuide", vim.log.levels.WARN)
    return
  end
  if index < 1 or index > #state.steps then
    vim.notify("End of TourGuide", vim.log.levels.INFO)
    return
  end
  state.index = index
  sidebar.render()
  state.windows = layout.render(state.current_step(), state.tour, state.windows)
end

function M.next() M.jump(state.index + 1) end
function M.prev() M.jump(state.index - 1) end

local function topic_at(index)
  local step = state.steps[index]
  return step and step._breadcrumbs and step._breadcrumbs[1] or nil
end

function M.next_topic()
  local current_topic = topic_at(state.index)
  for index = state.index + 1, #state.steps do
    if topic_at(index) ~= current_topic then
      M.jump(index)
      return
    end
  end
  vim.notify("End of TourGuide", vim.log.levels.INFO)
end

function M.prev_topic()
  local current_topic = topic_at(state.index)
  local previous_topic_index = nil

  for index = state.index - 1, 1, -1 do
    if topic_at(index) ~= current_topic then
      previous_topic_index = index
      break
    end
  end

  if not previous_topic_index then
    vim.notify("End of TourGuide", vim.log.levels.INFO)
    return
  end

  local previous_topic = topic_at(previous_topic_index)
  while previous_topic_index > 1 and topic_at(previous_topic_index - 1) == previous_topic do
    previous_topic_index = previous_topic_index - 1
  end
  M.jump(previous_topic_index)
end

return M
