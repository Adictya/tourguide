local state = require("tourguide.state")
local resolve = require("tourguide.resolve")

local M = {}
local dim_cache = {}
local apply_version = 0
local provider_ns = vim.api.nvim_create_namespace("tourguide/dim")
local provider_set = false

local function blend_channel(fg, bg, alpha)
  return math.floor((fg * alpha) + (bg * (1 - alpha)) + 0.5)
end

local function blend_color(fg, bg, alpha)
  local r = blend_channel(math.floor(fg / 0x10000) % 0x100, math.floor(bg / 0x10000) % 0x100, alpha)
  local g = blend_channel(math.floor(fg / 0x100) % 0x100, math.floor(bg / 0x100) % 0x100, alpha)
  local b = blend_channel(fg % 0x100, bg % 0x100, alpha)
  return string.format("#%02x%02x%02x", r, g, b)
end

local function define_highlights()
  local normal = vim.api.nvim_get_hl(0, { name = "Normal", link = false })
  local info = vim.api.nvim_get_hl(0, { name = "DiagnosticInfo", link = false })
  local search = vim.api.nvim_get_hl(0, { name = "Search", link = false })
  local fg = blend_color(normal.fg or 0xffffff, normal.bg or 0x000000, 0.45)
  local accent = search.fg or info.fg or normal.fg or 0xffffff
  local bg = search.bg or blend_color(info.fg or normal.fg or 0xffffff, normal.bg or 0x000000, 0.22)

  vim.api.nvim_set_hl(0, "TourGuidePrefix", { link = "DiagnosticInfo", default = true })
  vim.api.nvim_set_hl(0, "TourGuideNote", { link = "Comment", default = true })
  vim.api.nvim_set_hl(0, "TourGuideCallout", { bg = bg, default = true })
  vim.api.nvim_set_hl(0, "TourGuideCalloutLabel", { fg = accent, bg = bg, bold = true, default = true })
  vim.api.nvim_set_hl(0, "TourGuideCalloutText", { fg = normal.fg, bg = bg, default = true })
  vim.api.nvim_set_hl(0, "TourGuideSectionSign", { fg = accent, bold = true, default = true })
  vim.api.nvim_set_hl(0, "TourGuideDim", { fg = fg, default = true })
end

local function wrap_text(text, width)
  local lines = {}
  local current = ""

  for word in tostring(text):gmatch("%S+") do
    if current == "" then
      current = word
    elseif #current + #word + 1 <= width then
      current = current .. " " .. word
    else
      table.insert(lines, current)
      current = word
    end
  end

  if current ~= "" then table.insert(lines, current) end
  if #lines == 0 then table.insert(lines, "") end
  return lines
end

local function callout_width(buf)
  for _, win in ipairs(vim.api.nvim_list_wins()) do
    if vim.api.nvim_win_get_buf(win) == buf then
      return math.max(32, vim.api.nvim_win_get_width(win) - 8)
    end
  end
  return 72
end

local function note_lines(note, width)
  local lines = {}
  local prefix_width = vim.fn.strdisplaywidth("💬 ")
  local text_width = math.max(20, width - prefix_width)

  for index, text in ipairs(wrap_text(note, text_width)) do
    local prefix = index == 1 and "💬 " or string.rep(" ", prefix_width)
    local used = vim.fn.strdisplaywidth(prefix) + vim.fn.strdisplaywidth(text)
    table.insert(lines, {
      { prefix, "TourGuideCalloutLabel" },
      { text, "TourGuideCalloutText" },
      { string.rep(" ", math.max(0, width - used)), "TourGuideCallout" },
    })
  end
  return lines
end

local function dim_highlight(hl_name)
  hl_name = hl_name or "Normal"
  if dim_cache[hl_name] then return dim_cache[hl_name] end

  local normal = vim.api.nvim_get_hl(0, { name = "Normal", link = false })
  local ok, hl = pcall(vim.api.nvim_get_hl, 0, { name = hl_name, link = false })
  if not ok or not hl or not hl.fg then hl = normal end

  local group = "TourGuideDim" .. hl_name:gsub("[^%w_]", "_")
  vim.api.nvim_set_hl(0, group, vim.tbl_extend("force", hl, {
    fg = blend_color(hl.fg or normal.fg or 0xffffff, normal.bg or 0x000000, 0.45),
  }))
  dim_cache[hl_name] = group
  return group
end

local function clamp_line(buf, line)
  local count = vim.api.nvim_buf_line_count(buf)
  return math.max(0, math.min(count - 1, line - 1))
end

function M.clear(buf)
  if buf and vim.api.nvim_buf_is_valid(buf) then
    vim.api.nvim_buf_clear_namespace(buf, state.ns, 0, -1)
    vim.api.nvim_buf_clear_namespace(buf, provider_ns, 0, -1)
    state.dim_buffers[buf] = nil
  end
end

local function captures_at(buf, line, col)
  local ok, captures = pcall(vim.treesitter.get_captures_at_pos, buf, line, col)
  if ok then return captures end
  return {}
end

local function dim_line(buf, line, ephemeral)
  local dim = state.dim_buffers[buf]
  if not dim or dim.highlighted[line] then return true end

  local text = vim.api.nvim_buf_get_lines(buf, line, line + 1, false)[1]
  if not text then return true end

  if #text == 0 then
    vim.api.nvim_buf_set_extmark(buf, provider_ns, line, 0, {
      end_col = 0,
      ephemeral = ephemeral,
      hl_eol = true,
      hl_group = "TourGuideDim",
      priority = 200
    })
    return true
  end

  local start_col = 0
  local current_hl = nil
  local found_syntax = false

  for col = 0, #text do
    local captures = col < #text and captures_at(buf, line, col) or {}
    local capture = captures[#captures]
    local hl = capture and ("@" .. capture.capture) or "Normal"
    found_syntax = found_syntax or capture ~= nil

    if current_hl and hl ~= current_hl then
      vim.api.nvim_buf_set_extmark(buf, provider_ns, line, start_col, {
        end_col = col,
        ephemeral = ephemeral,
        hl_group = dim_highlight(current_hl),
        priority = 200
      })
      start_col = col
    end
    current_hl = hl
  end

  if current_hl then
    vim.api.nvim_buf_set_extmark(buf, provider_ns, line, start_col, {
      end_col = #text,
      ephemeral = ephemeral,
      hl_group = dim_highlight(current_hl),
      priority = 200
    })
  end

  return found_syntax
end

local function ensure_provider()
  if provider_set then return end
  provider_set = true

  vim.api.nvim_set_decoration_provider(provider_ns, {
    on_win = function(_, _, buf)
      return state.dim_buffers[buf] ~= nil
    end,
    on_line = function(_, _, buf, line)
      dim_line(buf, line, true)
    end,
  })
end

function M.apply(buf, sections, retry, focus_section)
  apply_version = apply_version + 1
  local version = apply_version
  define_highlights()
  M.clear(buf)
  dim_cache = {}
  local first = nil
  local highlighted = {}

  pcall(vim.treesitter.start, buf)
  ensure_provider()

  for index, section in ipairs(sections or {}) do
    local start_line, end_line = resolve.section(buf, section)
    first = first or start_line
    if focus_section == index then first = start_line end

    for line = start_line, end_line do
      local row = clamp_line(buf, line)
      highlighted[row] = true
      vim.api.nvim_buf_set_extmark(buf, state.ns, row, 0, {
        virt_text = { { "│ ", "TourGuideSectionSign" } },
        virt_text_pos = "inline",
        priority = 300
      })
    end

    if section.note then
      local placement = section.placement or "above"
      local target = placement == "below" and end_line or start_line
      local opts = {
        virt_lines = note_lines(section.note, callout_width(buf)),
        virt_lines_above = placement ~= "below" and placement ~= "eol" and placement ~= "inline"
      }
      vim.api.nvim_buf_set_extmark(buf, state.ns, clamp_line(buf, target), 0, opts)
    end
  end

  if first then
    state.dim_buffers[buf] = { highlighted = highlighted }
    local found_syntax = true
    for line = math.max(0, clamp_line(buf, first) - 3), math.min(vim.api.nvim_buf_line_count(buf) - 1, clamp_line(buf, first) + 3) do
      if not highlighted[line] then found_syntax = dim_line(buf, line, false) end
    end
    pcall(vim.api.nvim__redraw, { buf = buf, valid = false })

    if not retry and not found_syntax then
      vim.defer_fn(function()
        if version == apply_version and vim.api.nvim_buf_is_valid(buf) then
          M.apply(buf, sections, true, focus_section)
        end
      end, 100)
    end
  end

  return first
end

return M
