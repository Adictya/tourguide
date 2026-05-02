local state = require("tourguide.state")

local M = {}

local function define_highlights()
  vim.api.nvim_set_hl(0, "TourGuideTitle", { link = "Title", default = true })
  vim.api.nvim_set_hl(0, "TourGuideTopic", { link = "Directory", default = true })
  vim.api.nvim_set_hl(0, "TourGuideActive", { link = "Visual", default = true })
  vim.api.nvim_set_hl(0, "TourGuideFile", { link = "Comment", default = true })
end

local function ensure_sidebar()
  if
    state.sidebar.win
    and vim.api.nvim_win_is_valid(state.sidebar.win)
    and state.sidebar.buf
    and vim.api.nvim_buf_is_valid(state.sidebar.buf)
    and vim.api.nvim_win_get_buf(state.sidebar.win) == state.sidebar.buf
  then
    return state.sidebar.buf, state.sidebar.win
  end

  state.sidebar = { buf = nil, win = nil, width = state.sidebar.width or 34 }
  local previous = vim.api.nvim_get_current_win()
  vim.cmd("topleft vertical " .. tostring(state.sidebar.width or 34) .. "new")
  local win = vim.api.nvim_get_current_win()
  local buf = vim.api.nvim_get_current_buf()
  vim.bo[buf].buftype = "nofile"
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].swapfile = false
  vim.bo[buf].modifiable = false
  vim.wo[win].number = false
  vim.wo[win].relativenumber = false
  vim.wo[win].wrap = false
  vim.wo[win].winfixwidth = true
  vim.api.nvim_win_set_width(win, state.sidebar.width or 34)
  vim.api.nvim_buf_set_name(buf, "TourGuide")
  state.sidebar = { buf = buf, win = win, width = state.sidebar.width or 34 }
  if previous and vim.api.nvim_win_is_valid(previous) then vim.api.nvim_set_current_win(previous) end
  return buf, win
end

function M.render()
  if not state.tour then return end
  define_highlights()
  local buf = ensure_sidebar()
  local win = state.sidebar.win
  local lines = { state.tour.title or "TourGuide", string.rep("=", 24), "" }
  local hls = {
    { group = "TourGuideTitle", line = 0, start_col = 0, end_col = -1 },
    { group = "TourGuideTitle", line = 1, start_col = 0, end_col = -1 }
  }

  local last_topic = nil
  for i, step in ipairs(state.steps) do
    local topic = step._breadcrumbs[1]
    if topic ~= last_topic then
      local line = #lines
      table.insert(lines, topic)
      table.insert(hls, { group = "TourGuideTopic", line = line, start_col = 0, end_col = -1 })
      last_topic = topic
    end
    local active = i == state.index and ">" or " "
    local label = step._label
    if step._display_file then label = label .. "  [" .. step._display_file .. "]" end
    local line = #lines
    table.insert(lines, string.format("%s %02d. %s", active, i, label))
    if i == state.index then
      table.insert(hls, { group = "TourGuideActive", line = line, start_col = 0, end_col = -1 })
    elseif step._display_file then
      local start_col = lines[#lines]:find("%[")
      if start_col then
        table.insert(hls, { group = "TourGuideFile", line = line, start_col = start_col - 1, end_col = -1 })
      end
    end
  end

  vim.bo[buf].modifiable = true
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.api.nvim_buf_clear_namespace(buf, state.ns, 0, -1)
  for _, hl in ipairs(hls) do
    vim.api.nvim_buf_add_highlight(buf, state.ns, hl.group, hl.line, hl.start_col, hl.end_col)
  end
  if win and vim.api.nvim_win_is_valid(win) then
    vim.wo[win].winfixwidth = true
    vim.api.nvim_win_set_width(win, state.sidebar.width or 34)
  end
end

return M
