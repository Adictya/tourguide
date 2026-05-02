local M = {}

local function basename(path)
  return path:match("([^/]+)$") or path
end

local function is_step(node)
  return node.file or node.markdown or node.panes
end

local function flatten_node(node, breadcrumbs, out, depth)
  local next_breadcrumbs = vim.deepcopy(breadcrumbs)
  table.insert(next_breadcrumbs, node.title or "Untitled")

  if is_step(node) then
    node._breadcrumbs = next_breadcrumbs
    node._depth = depth
    node._label = node.title or node.file or "Untitled"
    node._kind = node.markdown and "markdown" or node.panes and "split" or "file"
    node._display_file = node.file and basename(node.file) or nil
    table.insert(out, node)
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
