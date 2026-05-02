local loader = require("tourguide.loader")
local state = require("tourguide.state")
local nav = require("tourguide.navigation")
local sidebar = require("tourguide.sidebar")
local keymaps = require("tourguide.keymaps")

local M = {}

function M.start(path_or_module)
  local tour, steps = loader.load(path_or_module)
  keymaps.restore()
  state.reset()
  state.tour = tour
  state.steps = steps
  state.index = 1
  sidebar.render()
  state.windows = require("tourguide.layout").render(state.current_step(), state.tour, {})
  keymaps.activate()
end

function M.next() nav.next() end
function M.prev() nav.prev() end
function M.next_topic() nav.next_topic() end
function M.prev_topic() nav.prev_topic() end
function M.jump(index) nav.jump(index) end

function M.close()
  keymaps.restore()
  for _, step in ipairs(state.steps) do
    if step.file and state.tour then
      local path = (state.tour.root or vim.fn.getcwd()):gsub("/$", "") .. "/" .. step.file
      local buf = vim.fn.bufnr(path)
      if buf ~= -1 then vim.api.nvim_buf_clear_namespace(buf, state.ns, 0, -1) end
    end
  end
  state.reset()
end

function M.setup(opts)
  opts = opts or {}
  if opts.sidebar_width then state.sidebar.width = opts.sidebar_width end
  if opts.prompt_keymaps ~= nil then state.options.prompt_keymaps = opts.prompt_keymaps end

  vim.api.nvim_create_user_command("TourGuide", function(cmd) M.start(cmd.args) end, { nargs = 1, complete = "file" })
  vim.api.nvim_create_user_command("TourGuideNext", M.next, {})
  vim.api.nvim_create_user_command("TourGuidePrev", M.prev, {})
  vim.api.nvim_create_user_command("TourGuideNextTopic", M.next_topic, {})
  vim.api.nvim_create_user_command("TourGuidePrevTopic", M.prev_topic, {})
  vim.api.nvim_create_user_command("TourGuideJump", function(cmd) M.jump(tonumber(cmd.args)) end, { nargs = 1 })
  vim.api.nvim_create_user_command("TourGuideClose", M.close, {})
end

return M
