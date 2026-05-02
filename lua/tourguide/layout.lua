local annotations = require("tourguide.annotations")
local state = require("tourguide.state")

local M = {}

local function enforce_sidebar_width()
  if state.sidebar.win and vim.api.nvim_win_is_valid(state.sidebar.win) then
    vim.wo[state.sidebar.win].winfixwidth = true
    pcall(vim.api.nvim_win_set_width, state.sidebar.win, state.sidebar.width or 34)
  end
end

local function find_content_window(exclude)
  for _, win in ipairs(vim.api.nvim_list_wins()) do
    if win ~= state.sidebar.win and win ~= exclude then return win end
  end
end

local function ensure_content_window()
  local current = vim.api.nvim_get_current_win()
  if current ~= state.sidebar.win then return current end
  local target = find_content_window()
  if target then
    vim.api.nvim_set_current_win(target)
    return target
  end
  vim.cmd("rightbelow vnew")
  enforce_sidebar_width()
  return vim.api.nvim_get_current_win()
end

local function full_path(root, file)
  if file:sub(1, 1) == "/" then return file end
  return root:gsub("/$", "") .. "/" .. file
end

local function open_file(root, file)
  ensure_content_window()
  vim.cmd("edit " .. vim.fn.fnameescape(full_path(root, file)))
  enforce_sidebar_width()
  return vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
end

local function with_flow_numbers(sections, start_index)
  if not start_index then return sections, start_index end
  local numbered = {}
  local n = start_index
  for _, section in ipairs(sections or {}) do
    local copy = vim.deepcopy(section)
    copy.note = string.format("[%02d] ", n) .. (copy.note or "")
    copy.hl = copy.hl or "TourGuideFlowSection"
    table.insert(numbered, copy)
    n = n + 1
  end
  return numbered, n
end

local function render_file(root, file, sections)
  local buf, win = open_file(root, file)
  local first = annotations.apply(buf, sections)
  if first then
    vim.api.nvim_win_set_cursor(win, { first, 0 })
    vim.cmd("normal! zz")
  end
  return buf, win
end

local function render_markdown(step)
  ensure_content_window()
  vim.cmd("enew")
  enforce_sidebar_width()
  local buf = vim.api.nvim_get_current_buf()
  vim.bo[buf].buftype = "nofile"
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].swapfile = false
  vim.bo[buf].filetype = "markdown"
  vim.api.nvim_buf_set_name(buf, "TourGuide: " .. (step.title or "Notes"))
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.split(step.markdown or "", "\n", { plain = true }))
  vim.bo[buf].modifiable = false
  return buf, vim.api.nvim_get_current_win()
end

local function close_extra_windows(windows, keep)
  for _, win in ipairs(windows or {}) do
    if vim.api.nvim_win_is_valid(win) and win ~= state.sidebar.win and win ~= keep and #vim.api.nvim_list_wins() > 1 then
      if vim.api.nvim_get_current_win() == win then
        local candidate = find_content_window(win) or state.sidebar.win
        if candidate and vim.api.nvim_win_is_valid(candidate) then vim.api.nvim_set_current_win(candidate) end
      end
      pcall(vim.api.nvim_win_close, win, true)
      enforce_sidebar_width()
    end
  end
end

function M.render(step, tour, previous_windows)
  local equalalways = vim.o.equalalways
  vim.o.equalalways = false
  local target = ensure_content_window()
  close_extra_windows(previous_windows, target)
  vim.api.nvim_set_current_win(target)
  local root = tour.root or vim.fn.getcwd()
  local windows = {}

  if step.markdown then
    local _, win = render_markdown(step)
    table.insert(windows, win)
  elseif step.panes then
    local layout = step.layout or "vertical"
    local flow_index = step.flow == false and nil or 1
    for i, pane in ipairs(step.panes) do
      if i > 1 then
        vim.cmd(layout == "horizontal" and "split" or "vsplit")
        enforce_sidebar_width()
      end
      local sections = pane.sections
      if flow_index then sections, flow_index = with_flow_numbers(pane.sections, flow_index) end
      local _, win = render_file(root, pane.file, sections)
      table.insert(windows, win)
    end
  elseif step.file then
    local _, win = render_file(root, step.file, step.sections)
    table.insert(windows, win)
  end

  enforce_sidebar_width()
  vim.o.equalalways = equalalways
  return windows
end

return M
