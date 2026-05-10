local M = {}

local function basename(path)
  return path:match("([^/]+)$") or path
end

local function is_step(node)
  return node.file or node.markdown or node.panes
end

local function section_label(step, section, index, file)
  local label = step.title or file or "Untitled"
  if section and section.note then
    label = section.note:gsub("^%[%d+%]%s*", "")
  elseif index then
    label = string.format("%s #%d", label, index)
  end
  if #label > 64 then label = label:sub(1, 61) .. "..." end
  return label
end

local function add_step(step, breadcrumbs, out, depth)
  step._breadcrumbs = breadcrumbs
  step._depth = depth
  step._kind = step.markdown and "markdown" or step.panes and "split" or "file"
  step._label = step._label or step.title or step.file or "Untitled"
  step._display_file = step.file and basename(step.file) or step._display_file
  table.insert(out, step)
end

local function add_file_sections(node, breadcrumbs, out, depth)
  if not node.sections or #node.sections <= 1 then
    add_step(node, breadcrumbs, out, depth)
    return
  end

  for index, section in ipairs(node.sections) do
    local step = vim.deepcopy(node)
    step._all_sections = vim.deepcopy(node.sections)
    step._focus_section = index
    step._label = section_label(node, section, index, node.file)
    add_step(step, breadcrumbs, out, depth)
  end
end

local function add_pane_sections(node, breadcrumbs, out, depth)
  local section_count = 0
  for _, pane in ipairs(node.panes or {}) do
    section_count = section_count + #(pane.sections or {})
  end

  if section_count <= 1 then
    add_step(node, breadcrumbs, out, depth)
    return
  end

  for pane_index, pane in ipairs(node.panes or {}) do
    for section_index, section in ipairs(pane.sections or {}) do
      local step = vim.deepcopy(node)
      step._all_panes = vim.deepcopy(node.panes)
      step._label = section_label(node, section, section_index, pane.file)
      step._display_file = basename(pane.file)
      step._focus_pane = pane_index
      step._focus_section = section_index

      add_step(step, breadcrumbs, out, depth)
    end
  end
end

local function flatten_node(node, breadcrumbs, out, depth)
  local next_breadcrumbs = vim.deepcopy(breadcrumbs)
  table.insert(next_breadcrumbs, node.title or "Untitled")

  if is_step(node) then
    if node.markdown then
      add_step(node, next_breadcrumbs, out, depth)
    elseif node.panes then
      add_pane_sections(node, next_breadcrumbs, out, depth)
    else
      add_file_sections(node, next_breadcrumbs, out, depth)
    end
  end

  for _, child in ipairs(node.children or {}) do
    flatten_node(child, next_breadcrumbs, out, depth + 1)
  end
end

function M.flatten(tour)
  local out = {}
  for _, topic in ipairs(tour.topics or {}) do
    flatten_node(topic, {}, out, 0)
  end
  return out
end

function M.load(path_or_module)
  local ok, tour
  if path_or_module:match("%.lua$") or path_or_module:match("/") then
    ok, tour = pcall(dofile, path_or_module)
  else
    ok, tour = pcall(require, path_or_module)
  end
  if not ok then error(tour) end
  if type(tour) ~= "table" then error("tour must return a table") end
  if not tour.root then tour.root = vim.fn.getcwd() end
  local steps = M.flatten(tour)
  if #steps == 0 then error("tour has no steps") end
  return tour, steps
end

return M
