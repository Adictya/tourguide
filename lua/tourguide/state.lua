local M = {}

M.ns = vim.api.nvim_create_namespace("tourguide")
M.tour = nil
M.steps = {}
M.index = 0
M.sidebar = { buf = nil, win = nil, width = 34 }
M.windows = {}
M.options = { prompt_keymaps = true }

function M.reset()
  M.tour = nil
  M.steps = {}
  M.index = 0
  M.windows = {}
  if M.sidebar.win and vim.api.nvim_win_is_valid(M.sidebar.win) then
    pcall(vim.api.nvim_win_close, M.sidebar.win, true)
  end
  M.sidebar = { buf = nil, win = nil, width = M.sidebar.width or 34 }
end

function M.current_step()
  return M.steps[M.index]
end

return M
