local state = require("tourguide.state")

local M = {}

local actions = {
  { key = "next_section", prompt = "TourGuide next section keymap (empty to skip):", command = "<Cmd>TourGuideNext<CR>" },
  { key = "prev_section", prompt = "TourGuide previous section keymap (empty to skip):", command = "<Cmd>TourGuidePrev<CR>" },
  { key = "next_topic", prompt = "TourGuide next topic keymap (empty to skip):", command = "<Cmd>TourGuideNextTopic<CR>" },
  { key = "prev_topic", prompt = "TourGuide previous topic keymap (empty to skip):", command = "<Cmd>TourGuidePrevTopic<CR>" },
}

local active = {}
local active_buffers = {}
local preferences = nil
local augroup = vim.api.nvim_create_augroup("tourguide_keymaps", { clear = true })

local function config_path()
  return vim.fn.stdpath("state") .. "/tourguide/keymaps.json"
end

local function read_preferences()
  local path = config_path()
  if vim.fn.filereadable(path) == 0 then return nil end

  local ok, decoded = pcall(vim.fn.json_decode, table.concat(vim.fn.readfile(path), "\n"))
  if ok and type(decoded) == "table" then return decoded end
  vim.notify("TourGuide could not read keymap preferences", vim.log.levels.WARN)
  return nil
end

local function write_preferences(preferences)
  local path = config_path()
  vim.fn.mkdir(vim.fn.fnamemodify(path, ":h"), "p")
  vim.fn.writefile(vim.split(vim.fn.json_encode(preferences), "\n", { plain = true }), path)
end

local function buffer_map(buf, lhs)
  for _, mapping in ipairs(vim.api.nvim_buf_get_keymap(buf, "n")) do
    if mapping.lhs == lhs then return mapping end
  end
end

local function prompt_preferences(done)
  local preferences = {}
  local index = 1

  local function prompt_next()
    local action = actions[index]
    if not action then
      write_preferences(preferences)
      done(preferences)
      return
    end

    vim.ui.input({ prompt = action.prompt }, function(value)
      preferences[action.key] = value or ""
      index = index + 1
      prompt_next()
    end)
  end

  prompt_next()
end

local function restore_map(lhs, previous, buf)
  if buf then
    pcall(vim.keymap.del, "n", lhs, { buffer = buf })
  else
    pcall(vim.keymap.del, "n", lhs)
  end
  if previous and previous.lhs and previous.lhs ~= "" then
    if buf then
      pcall(vim.api.nvim_buf_call, buf, function()
        vim.fn.mapset("n", true, previous)
      end)
    else
      pcall(vim.fn.mapset, "n", false, previous)
    end
  end
end

function M.restore()
  for _, mapping in ipairs(active) do
    restore_map(mapping.lhs, mapping.previous)
  end
  for buf, mappings in pairs(active_buffers) do
    if vim.api.nvim_buf_is_valid(buf) then
      for _, mapping in ipairs(mappings) do
        restore_map(mapping.lhs, mapping.previous, buf)
      end
    end
  end
  active = {}
  active_buffers = {}
  preferences = nil
  vim.api.nvim_clear_autocmds({ group = augroup })
end

local function apply_buffer_maps(buf)
  if not preferences or not vim.api.nvim_buf_is_valid(buf) then return end
  if vim.bo[buf].buftype ~= "" and vim.bo[buf].buftype ~= "nofile" then return end

  active_buffers[buf] = active_buffers[buf] or {}
  local tracked = {}
  for _, mapping in ipairs(active_buffers[buf]) do
    tracked[mapping.lhs] = mapping
  end

  for _, action in ipairs(actions) do
    local lhs = preferences[action.key]
    if type(lhs) == "string" and lhs ~= "" then
      local previous = tracked[lhs] and tracked[lhs].previous or buffer_map(buf, lhs)
      if not previous or not previous.lhs or previous.lhs == "" or previous.desc == "TourGuide " .. action.key:gsub("_", " ") then
        previous = nil
      end
      if not tracked[lhs] then table.insert(active_buffers[buf], { lhs = lhs, previous = previous }) end
      vim.keymap.set("n", lhs, action.command, {
        buffer = buf,
        silent = true,
        desc = "TourGuide " .. action.key:gsub("_", " "),
      })
    end
  end
end

local function apply_current_buffer_maps()
  apply_buffer_maps(vim.api.nvim_get_current_buf())
  vim.defer_fn(function()
    if state.tour then apply_buffer_maps(vim.api.nvim_get_current_buf()) end
  end, 100)
end

local function apply_preferences(next_preferences)
  M.restore()
  preferences = next_preferences

  for _, action in ipairs(actions) do
    local lhs = preferences[action.key]
    if type(lhs) == "string" and lhs ~= "" then
      local previous = vim.fn.maparg(lhs, "n", false, true)
      if not previous or not previous.lhs or previous.lhs == "" then previous = nil end
      table.insert(active, { lhs = lhs, previous = previous })
      vim.keymap.set("n", lhs, action.command, { silent = true, desc = "TourGuide " .. action.key:gsub("_", " ") })
    end
  end

  apply_current_buffer_maps()
  vim.api.nvim_create_autocmd({ "BufEnter", "FileType", "LspAttach" }, {
    group = augroup,
    callback = apply_current_buffer_maps,
  })
end

function M.activate()
  if not state.options.prompt_keymaps or #vim.api.nvim_list_uis() == 0 then
    M.restore()
    return
  end

  local preferences = read_preferences()
  if preferences then
    apply_preferences(preferences)
    return
  end

  prompt_preferences(apply_preferences)
end

return M
